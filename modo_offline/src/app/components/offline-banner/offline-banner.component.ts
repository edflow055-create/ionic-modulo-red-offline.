/**
 * ============================================================
 * offline-banner.component.ts
 * ============================================================
 * Componente que combina el detector de red con el modo offline.
 * Muestra al usuario mensajes informativos sobre su estado de
 * conectividad y el número de elementos pendientes de sync.
 * ============================================================
 */

import {
  Component,
  OnInit,
  OnDestroy,
  ChangeDetectionStrategy,
  ChangeDetectorRef
} from '@angular/core';
import { Subscription, combineLatest } from 'rxjs';
import { NetworkService } from '../../services/network.service';
import { OfflineStorageService, SyncStatus } from '../../services/offline-storage.service';

@Component({
  selector: 'app-offline-banner',
  templateUrl: './offline-banner.component.html',
  styleUrls: ['./offline-banner.component.scss'],
  changeDetection: ChangeDetectionStrategy.OnPush
})
export class OfflineBannerComponent implements OnInit, OnDestroy {

  // ── Estado del template ──────────────────────────────────────
  isOnline: boolean = true;
  pendingCount: number = 0;
  syncStatus: SyncStatus = 'idle';

  /** Controla si el banner de "sincronización completa" es visible */
  showSyncDoneMessage: boolean = false;

  private syncDoneTimer: ReturnType<typeof setTimeout> | null = null;
  private subscriptions: Subscription[] = [];

  constructor(
    private networkService: NetworkService,
    private offlineStorage: OfflineStorageService,
    private cdr: ChangeDetectorRef
  ) {}

  ngOnInit(): void {
    // Combinar los tres Observables en una sola suscripción
    const combined$ = combineLatest([
      this.networkService.getOnlineStatus(),
      this.offlineStorage.getPendingCount(),
      this.offlineStorage.getSyncStatus()
    ]);

    this.subscriptions.push(
      combined$.subscribe(([isOnline, pendingCount, syncStatus]) => {
        this.isOnline = isOnline;
        this.pendingCount = pendingCount;

        // Detectar cuando sync termina exitosamente para mostrar mensaje
        if (syncStatus === 'success' && this.syncStatus === 'syncing') {
          this.triggerSyncDoneFeedback();
        }

        this.syncStatus = syncStatus;
        this.cdr.markForCheck();
      })
    );
  }

  ngOnDestroy(): void {
    this.subscriptions.forEach(s => s.unsubscribe());
    if (this.syncDoneTimer) clearTimeout(this.syncDoneTimer);
  }

  // ── Acciones ─────────────────────────────────────────────────

  /**
   * Permite al usuario forzar la sincronización manual.
   * Solo disponible cuando hay conexión y hay datos pendientes.
   */
  async manualSync(): Promise<void> {
    if (!this.isOnline) return;
    await this.offlineStorage.syncPendingRecords();
  }

  /**
   * Muestra un mensaje verde de éxito durante 4 segundos
   * cuando la sincronización automática termina correctamente.
   */
  private triggerSyncDoneFeedback(): void {
    this.showSyncDoneMessage = true;
    this.syncDoneTimer = setTimeout(() => {
      this.showSyncDoneMessage = false;
      this.cdr.markForCheck();
    }, 4000);
  }

  // ── Helpers ──────────────────────────────────────────────────

  /** Texto del botón de sincronización según el estado actual */
  getSyncButtonText(): string {
    if (this.syncStatus === 'syncing') return 'Sincronizando...';
    return `Sincronizar ahora (${this.pendingCount})`;
  }

  /** Devuelve true cuando el botón debe estar deshabilitado */
  isSyncDisabled(): boolean {
    return !this.isOnline || this.syncStatus === 'syncing';
  }
}
