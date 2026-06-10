/**
 * ============================================================
 * network-status.component.ts
 * ============================================================
 * Componente visual que muestra el estado de conectividad
 * de la aplicación en tiempo real mediante un banner/badge
 * persistente en la parte superior de la pantalla.
 *
 * Uso en template padre:
 *   <app-network-status></app-network-status>
 * ============================================================
 */

import {
  Component,
  OnInit,
  OnDestroy,
  ChangeDetectionStrategy,
  ChangeDetectorRef
} from '@angular/core';
import { Subscription } from 'rxjs';
import { NetworkService, NetworkState } from '../../services/network.service';
import { ConnectionType } from '@capacitor/network';

/**
 * Mapa de íconos Ionicons según el tipo de conexión detectado.
 * Permite mostrar un icono diferente para WiFi, datos móviles
 * y sin conexión.
 */
const ICON_MAP: Record<ConnectionType | string, string> = {
  wifi: 'wifi-outline',
  cellular: 'cellular-outline',
  none: 'cloud-offline-outline',
  unknown: 'help-circle-outline'
};

@Component({
  selector: 'app-network-status',
  templateUrl: './network-status.component.html',
  styleUrls: ['./network-status.component.scss'],
  /**
   * OnPush: el componente solo se re-renderiza cuando cambia
   * alguna referencia de input o cuando se llama markForCheck().
   * Optimiza el rendimiento al evitar re-renders innecesarios.
   */
  changeDetection: ChangeDetectionStrategy.OnPush
})
export class NetworkStatusComponent implements OnInit, OnDestroy {

  // ── Propiedades de template ──────────────────────────────────

  /** Estado actual de la conexión */
  isOnline: boolean = true;

  /** Tipo de conexión detectado */
  connectionType: ConnectionType = 'unknown';

  /** Ícono de Ionicons correspondiente al estado actual */
  networkIcon: string = 'wifi-outline';

  /** Texto descriptivo para mostrar al usuario */
  statusText: string = '';

  /** Controla si el banner de reconexión está visible */
  showReconnectedBanner: boolean = false;

  /** Referencia al timeout para ocultar el banner de reconexión */
  private reconnectedTimer: ReturnType<typeof setTimeout> | null = null;

  /** Último estado conocido para detectar transiciones */
  private lastOnlineState: boolean = true;

  /** Array de suscripciones para limpieza en ngOnDestroy */
  private subscriptions: Subscription[] = [];

  constructor(
    private networkService: NetworkService,
    private cdr: ChangeDetectorRef    // Necesario con ChangeDetectionStrategy.OnPush
  ) {}

  // ── Ciclo de vida ────────────────────────────────────────────

  ngOnInit(): void {
    // Suscribirse al Observable de estado de red
    const networkSub = this.networkService.getNetworkState().subscribe(
      (state: NetworkState) => this.onNetworkStateChange(state)
    );
    this.subscriptions.push(networkSub);
  }

  ngOnDestroy(): void {
    // Limpiar todas las suscripciones para evitar memory leaks
    this.subscriptions.forEach(sub => sub.unsubscribe());

    // Limpiar timers pendientes
    if (this.reconnectedTimer) {
      clearTimeout(this.reconnectedTimer);
    }
  }

  // ── Lógica privada ───────────────────────────────────────────

  /**
   * Reacciona a cada cambio de estado de red.
   * Actualiza las propiedades del template y gestiona
   * el banner temporal de "conexión restaurada".
   */
  private onNetworkStateChange(state: NetworkState): void {
    const wasOffline = !this.lastOnlineState;
    const isNowOnline = state.isOnline;

    // Detectar transición offline → online para mostrar banner de éxito
    if (wasOffline && isNowOnline) {
      this.showReconnectedFeedback();
    }

    // Actualizar propiedades del template
    this.isOnline = state.isOnline;
    this.connectionType = state.connectionType;
    this.networkIcon = this.getIconForConnectionType(state.connectionType, state.isOnline);
    this.statusText = this.buildStatusText(state);
    this.lastOnlineState = state.isOnline;

    // Notificar al detector de cambios (requerido con OnPush)
    this.cdr.markForCheck();
  }

  /**
   * Muestra un banner verde "Conexión restaurada" durante 3 segundos
   * cuando el dispositivo vuelve a tener conexión.
   */
  private showReconnectedFeedback(): void {
    this.showReconnectedBanner = true;

    // Ocultar banner automáticamente después de 3 segundos
    this.reconnectedTimer = setTimeout(() => {
      this.showReconnectedBanner = false;
      this.cdr.markForCheck();
    }, 3000);
  }

  /**
   * Selecciona el ícono correcto según tipo de conexión y estado.
   */
  private getIconForConnectionType(type: ConnectionType, isOnline: boolean): string {
    if (!isOnline) return 'cloud-offline-outline';
    return ICON_MAP[type] || 'globe-outline';
  }

  /**
   * Construye el texto descriptivo del estado de red.
   */
  private buildStatusText(state: NetworkState): string {
    if (!state.isOnline) return 'Sin conexión a internet';

    const typeLabels: Record<string, string> = {
      wifi: 'Conectado vía WiFi',
      cellular: 'Conectado vía datos móviles',
      unknown: 'Conectado'
    };
    return typeLabels[state.connectionType] || 'Conectado';
  }

  // ── Helpers para template ────────────────────────────────────

  /**
   * Retorna la clase CSS del badge según el estado de conexión.
   * Permite colorear el badge de rojo (offline) o verde (online).
   */
  getBadgeClass(): string {
    return this.isOnline ? 'badge--online' : 'badge--offline';
  }

  /**
   * Retorna el color del ícono de Ionic para el estado actual.
   */
  getIconColor(): string {
    return this.isOnline ? 'success' : 'danger';
  }
}
