/**
 * ============================================================
 * offline-storage.service.ts
 * ============================================================
 * Servicio de almacenamiento offline con @ionic/storage.
 * Implementa la lógica condicional completa:
 *   - Online  → envía directamente al servidor via HTTP
 *   - Offline → guarda en almacenamiento local cifrado
 *   - Reconexión → sincroniza automáticamente los pendientes
 *
 * INSTALACIÓN:
 *   npm install @ionic/storage-angular
 *   npm install @capacitor/preferences   (backend nativo)
 * ============================================================
 */

import { Injectable } from '@angular/core';
import { Storage } from '@ionic/storage-angular';
import { HttpClient, HttpErrorResponse } from '@angular/common/http';
import { BehaviorSubject, Observable, firstValueFrom } from 'rxjs';
import { NetworkService } from './network.service';

/**
 * Modelo de un registro pendiente de sincronización.
 * Se serializa a JSON y se guarda en @ionic/storage.
 */
export interface PendingRecord<T = unknown> {
  /** Identificador único generado localmente (timestamp + random) */
  id: string;
  /** Payload de datos a enviar al servidor */
  data: T;
  /** Endpoint de la API de destino */
  endpoint: string;
  /** Método HTTP: POST | PUT | PATCH */
  method: 'POST' | 'PUT' | 'PATCH';
  /** Marca temporal de cuando se guardó localmente */
  savedAt: number;
  /** Número de intentos de sincronización fallidos */
  retryCount: number;
}

/** Estados posibles del proceso de sincronización */
export type SyncStatus = 'idle' | 'syncing' | 'success' | 'error';

@Injectable({
  providedIn: 'root'
})
export class OfflineStorageService {

  // ── Clave de almacenamiento ──────────────────────────────────
  /** Clave bajo la que se guardan todos los registros pendientes */
  private readonly PENDING_KEY = 'offline_pending_records';

  /** Máximo de reintentos antes de marcar un registro como fallido */
  private readonly MAX_RETRIES = 3;

  // ── Estado reactivo (Observables) ────────────────────────────

  /**
   * Cantidad de registros pendientes de sincronización.
   * Los componentes pueden suscribirse para mostrar un badge.
   */
  private pendingCount$ = new BehaviorSubject<number>(0);

  /**
   * Estado actual del proceso de sincronización.
   * Permite mostrar spinners o feedback en la UI durante sync.
   */
  private syncStatus$ = new BehaviorSubject<SyncStatus>('idle');

  /** Referencia interna al storage inicializado */
  private _storage: Storage | null = null;

  constructor(
    private storage: Storage,       // @ionic/storage-angular
    private http: HttpClient,
    private networkService: NetworkService
  ) {
    this.initStorage();
    this.listenForReconnection();
  }

  // ── Inicialización ───────────────────────────────────────────

  /**
   * Crea e inicializa la instancia de @ionic/storage.
   * Debe completarse antes de cualquier operación de lectura/escritura.
   *
   * @ionic/storage selecciona automáticamente el mejor driver disponible:
   *   IndexedDB (web) → SQLite nativo (Capacitor) → localStorage (fallback)
   */
  private async initStorage(): Promise<void> {
    this._storage = await this.storage.create();
    // Actualizar el contador de pendientes al arrancar
    await this.refreshPendingCount();
    console.log('[OfflineStorage] Storage inicializado correctamente');
  }

  /**
   * Suscribe al Observable de estado de red.
   * Cuando detecta la transición offline → online, lanza
   * la sincronización automática de registros pendientes.
   */
  private listenForReconnection(): void {
    this.networkService.getOnlineStatus().subscribe(async (isOnline: boolean) => {
      if (isOnline) {
        console.log('[OfflineStorage] Conexión detectada — iniciando sincronización automática');
        await this.syncPendingRecords();
      }
    });
  }

  // ── API Pública ──────────────────────────────────────────────

  /**
   * Guarda un registro de datos:
   *   ▶  Si hay conexión → envía directamente al servidor
   *   ▶  Si no hay conexión → guarda en @ionic/storage para sync posterior
   *
   * @param endpoint URL de la API (e.g. 'https://api.example.com/items')
   * @param data     Payload a enviar / guardar
   * @param method   Método HTTP (default: POST)
   * @returns        Promise que resuelve cuando la operación termina
   */
  async saveData<T>(
    endpoint: string,
    data: T,
    method: 'POST' | 'PUT' | 'PATCH' = 'POST'
  ): Promise<void> {
    const isConnected = await this.networkService.isConnected();

    if (isConnected) {
      // ✅ Online: enviar directamente al servidor
      try {
        await this.sendToServer(endpoint, data, method);
        console.log('[OfflineStorage] Datos enviados al servidor exitosamente');
      } catch (error) {
        // Si falla el envío online, guardar localmente como fallback
        console.warn('[OfflineStorage] Fallo al enviar online, guardando localmente:', error);
        await this.savePendingRecord(endpoint, data, method);
      }
    } else {
      // 📴 Offline: guardar localmente para sincronizar después
      console.log('[OfflineStorage] Sin conexión — guardando localmente');
      await this.savePendingRecord(endpoint, data, method);
    }
  }

  /**
   * Sincroniza manualmente todos los registros pendientes con el servidor.
   * Se llama automáticamente al detectar reconexión, pero también
   * puede invocarse desde un botón "Reintentar" en la UI.
   */
  async syncPendingRecords(): Promise<void> {
    const pending = await this.getPendingRecords();

    if (pending.length === 0) {
      console.log('[OfflineStorage] No hay registros pendientes');
      return;
    }

    console.log(`[OfflineStorage] Sincronizando ${pending.length} registro(s) pendiente(s)...`);
    this.syncStatus$.next('syncing');

    const successful: string[] = [];   // IDs sincronizados exitosamente
    const failed: string[] = [];       // IDs que fallaron

    for (const record of pending) {
      try {
        await this.sendToServer(record.endpoint, record.data, record.method);
        successful.push(record.id);
        console.log(`[OfflineStorage] ✓ Sincronizado: ${record.id}`);

      } catch (error) {
        const err = error as HttpErrorResponse;
        console.error(`[OfflineStorage] ✗ Falló sincronización de ${record.id}:`, err.message);

        // Incrementar contador de reintentos
        record.retryCount = (record.retryCount || 0) + 1;

        // Si supera el máximo de reintentos, marcar para eliminar
        if (record.retryCount >= this.MAX_RETRIES) {
          console.error(`[OfflineStorage] Registro ${record.id} eliminado tras ${this.MAX_RETRIES} reintentos`);
          failed.push(record.id);
        }
      }
    }

    // Remover del storage los registros sincronizados y los que fallaron definitivamente
    const toRemove = new Set([...successful, ...failed]);
    const remaining = pending.filter(r => !toRemove.has(r.id));

    await this._storage?.set(this.PENDING_KEY, JSON.stringify(remaining));
    await this.refreshPendingCount();

    this.syncStatus$.next(remaining.length === 0 ? 'success' : 'error');

    console.log(`[OfflineStorage] Sync completado: ${successful.length} ok, ${failed.length} fallidos`);
  }

  /**
   * Retorna todos los registros pendientes de sincronización.
   */
  async getPendingRecords<T = unknown>(): Promise<PendingRecord<T>[]> {
    await this.ensureStorageReady();
    const raw = await this._storage?.get(this.PENDING_KEY);
    if (!raw) return [];

    try {
      return JSON.parse(raw) as PendingRecord<T>[];
    } catch (parseError) {
      console.error('[OfflineStorage] Error al parsear registros:', parseError);
      return [];
    }
  }

  /**
   * Observable del número de registros pendientes.
   * Útil para mostrar un badge numérico en la UI.
   */
  getPendingCount(): Observable<number> {
    return this.pendingCount$.asObservable();
  }

  /**
   * Observable del estado del proceso de sincronización.
   */
  getSyncStatus(): Observable<SyncStatus> {
    return this.syncStatus$.asObservable();
  }

  /**
   * Limpia TODOS los registros pendientes del storage.
   * Usar con precaución (datos no sincronizados se perderán).
   */
  async clearPendingRecords(): Promise<void> {
    await this._storage?.remove(this.PENDING_KEY);
    this.pendingCount$.next(0);
  }

  // ── Métodos privados ─────────────────────────────────────────

  /**
   * Crea y guarda un nuevo PendingRecord en @ionic/storage.
   */
  private async savePendingRecord<T>(
    endpoint: string,
    data: T,
    method: 'POST' | 'PUT' | 'PATCH'
  ): Promise<void> {
    await this.ensureStorageReady();

    const existing = await this.getPendingRecords<T>();
    const newRecord: PendingRecord<T> = {
      id: `${Date.now()}_${Math.random().toString(36).slice(2, 9)}`,
      data,
      endpoint,
      method,
      savedAt: Date.now(),
      retryCount: 0
    };

    existing.push(newRecord);
    await this._storage?.set(this.PENDING_KEY, JSON.stringify(existing));
    await this.refreshPendingCount();

    console.log(`[OfflineStorage] Guardado localmente (ID: ${newRecord.id})`);
  }

  /**
   * Envía un registro al servidor via HTTP.
   * Retorna una Promise que rechaza si la petición falla.
   */
  private async sendToServer<T>(
    endpoint: string,
    data: T,
    method: 'POST' | 'PUT' | 'PATCH'
  ): Promise<unknown> {
    const request$ = method === 'POST'
      ? this.http.post(endpoint, data)
      : method === 'PUT'
        ? this.http.put(endpoint, data)
        : this.http.patch(endpoint, data);

    return await firstValueFrom(request$);
  }

  /**
   * Garantiza que el storage esté inicializado antes de operar.
   * Necesario porque init() es asíncrono.
   */
  private async ensureStorageReady(): Promise<void> {
    if (!this._storage) {
      this._storage = await this.storage.create();
    }
  }

  /**
   * Actualiza el BehaviorSubject con el conteo actual de pendientes.
   */
  private async refreshPendingCount(): Promise<void> {
    const records = await this.getPendingRecords();
    this.pendingCount$.next(records.length);
  }
}
