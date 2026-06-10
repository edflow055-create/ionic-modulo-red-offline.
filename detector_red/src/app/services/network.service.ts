/**
 * ============================================================
 * network.service.ts
 * ============================================================
 * Servicio Angular que encapsula el plugin @capacitor/network.
 * Gestiona el estado de la conexión de red en tiempo real y
 * expone Observables que los componentes pueden suscribirse.
 *
 * Dependencias requeridas:
 *   npm install @capacitor/network
 *   npx cap sync
 * ============================================================
 */

import { Injectable, OnDestroy } from '@angular/core';
import { BehaviorSubject, Observable } from 'rxjs';
import { distinctUntilChanged } from 'rxjs/operators';
import { Network, ConnectionStatus, ConnectionType } from '@capacitor/network';

/**
 * Interfaz que modela el estado completo de red
 * expuesto por el servicio a los componentes consumidores.
 */
export interface NetworkState {
  /** true = hay conexión activa; false = sin conexión */
  isOnline: boolean;
  /** Tipo de conexión: 'wifi' | 'cellular' | 'none' | 'unknown' */
  connectionType: ConnectionType;
  /** Marca de tiempo del último cambio de estado */
  lastChecked: Date;
}

@Injectable({
  providedIn: 'root'   // Singleton disponible en toda la aplicación
})
export class NetworkService implements OnDestroy {

  // ── Estado interno ──────────────────────────────────────────
  /**
   * BehaviorSubject almacena el último estado conocido de red.
   * Se inicializa con "online + wifi" como valor optimista;
   * el estado real se actualiza al completarse initNetworkListener().
   */
  private networkState$ = new BehaviorSubject<NetworkState>({
    isOnline: true,
    connectionType: 'unknown',
    lastChecked: new Date()
  });

  constructor() {
    // Arranca la escucha de cambios de red en cuanto se inyecta el servicio
    this.initNetworkListener();
  }

  // ── Inicialización ───────────────────────────────────────────

  /**
   * Consulta el estado inicial de red y registra el listener
   * de Capacitor para detectar cambios en tiempo real.
   *
   * Se debe llamar UNA SOLA VEZ en el constructor para evitar
   * registrar múltiples listeners duplicados.
   */
  private async initNetworkListener(): Promise<void> {
    try {
      // 1️⃣  Consulta el estado actual (snapshot sincrónico desde el SO nativo)
      const status: ConnectionStatus = await Network.getStatus();
      this.emitNetworkState(status);

      // 2️⃣  Registra un listener que se disparará cada vez que la
      //     red cambie (p. ej. usuario activa/desactiva modo avión)
      await Network.addListener('networkStatusChange', (status: ConnectionStatus) => {
        console.log('[NetworkService] Estado de red cambió:', status);
        this.emitNetworkState(status);
      });

    } catch (error) {
      console.error('[NetworkService] Error inicializando listener de red:', error);
    }
  }

  /**
   * Convierte un ConnectionStatus nativo en NetworkState
   * y lo emite a todos los suscriptores activos.
   */
  private emitNetworkState(status: ConnectionStatus): void {
    const newState: NetworkState = {
      isOnline: status.connected,
      connectionType: status.connectionType,
      lastChecked: new Date()
    };
    this.networkState$.next(newState);
  }

  // ── API Pública ──────────────────────────────────────────────

  /**
   * Observable del estado completo de red.
   * Emite solo cuando el estado cambia (distinctUntilChanged
   * evita emisiones duplicadas ante múltiples lecturas iguales).
   *
   * @example
   * this.networkService.getNetworkState().subscribe(state => {
   *   this.isOnline = state.isOnline;
   * });
   */
  getNetworkState(): Observable<NetworkState> {
    return this.networkState$.asObservable().pipe(
      distinctUntilChanged((a, b) =>
        a.isOnline === b.isOnline && a.connectionType === b.connectionType
      )
    );
  }

  /**
   * Observable simplificado que emite solo el booleano online/offline.
   * Útil para componentes que solo necesitan saber si hay conexión.
   */
  getOnlineStatus(): Observable<boolean> {
    return new Observable(observer => {
      this.networkState$.subscribe(state => observer.next(state.isOnline));
    });
  }

  /**
   * Consulta sincrónica al estado actual en memoria.
   * NO realiza una llamada nativa — lee el último valor del BehaviorSubject.
   *
   * @returns El estado de red más reciente conocido
   */
  getCurrentState(): NetworkState {
    return this.networkState$.getValue();
  }

  /**
   * Consulta asíncrona directa al plugin nativo (más costosa).
   * Usar cuando se necesita máxima precisión, por ejemplo antes de
   * una petición HTTP crítica.
   *
   * @returns Promise con el ConnectionStatus del dispositivo
   */
  async getStatus(): Promise<ConnectionStatus> {
    return await Network.getStatus();
  }

  /**
   * Conveniencia: devuelve true si el dispositivo tiene conexión activa.
   */
  async isConnected(): Promise<boolean> {
    const status = await Network.getStatus();
    return status.connected;
  }

  // ── Ciclo de vida ────────────────────────────────────────────

  /**
   * Limpia todos los listeners de Capacitor cuando el servicio se destruye.
   * Evita memory leaks en aplicaciones con lifecycle corto.
   */
  async ngOnDestroy(): Promise<void> {
    await Network.removeAllListeners();
    this.networkState$.complete();
  }
}
