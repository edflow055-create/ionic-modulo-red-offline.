/**
 * ============================================================
 * home.page.ts  ─  Ejemplo de uso integrado (Entregable 2)
 * ============================================================
 * Página de demostración que muestra cómo usar el
 * OfflineStorageService para guardar formularios de forma
 * transparente, ya sea online u offline.
 * ============================================================
 */

import { Component, OnInit } from '@angular/core';
import { ToastController } from '@ionic/angular';
import { OfflineStorageService } from '../services/offline-storage.service';
import { NetworkService } from '../services/network.service';

/** Modelo de ejemplo: un ítem de lista de tareas */
interface TaskItem {
  title: string;
  description: string;
  createdAt: string;
}

@Component({
  selector: 'app-home',
  template: `
    <!-- Componente de estado de red siempre visible -->
    <app-network-status></app-network-status>

    <ion-header>
      <ion-toolbar>
        <ion-title>Mis Tareas</ion-title>

        <!-- Badge con cantidad de pendientes en el header -->
        <ion-buttons slot="end">
          <ion-badge color="warning" *ngIf="pendingCount > 0">
            {{ pendingCount }}
          </ion-badge>
        </ion-buttons>
      </ion-toolbar>
    </ion-header>

    <ion-content class="ion-padding">
      <!-- Banner de estado offline / sync -->
      <app-offline-banner></app-offline-banner>

      <!-- Formulario para agregar tareas -->
      <ion-card>
        <ion-card-header>
          <ion-card-title>Nueva Tarea</ion-card-title>
        </ion-card-header>

        <ion-card-content>
          <ion-item>
            <ion-label position="stacked">Título</ion-label>
            <ion-input
              [(ngModel)]="newTask.title"
              placeholder="Escribe el título de la tarea">
            </ion-input>
          </ion-item>

          <ion-item>
            <ion-label position="stacked">Descripción</ion-label>
            <ion-textarea
              [(ngModel)]="newTask.description"
              placeholder="Describe la tarea..."
              rows="3">
            </ion-textarea>
          </ion-item>

          <ion-button
            expand="block"
            class="ion-margin-top"
            [color]="isOnline ? 'primary' : 'warning'"
            (click)="saveTask()">
            <ion-icon
              [name]="isOnline ? 'cloud-upload-outline' : 'save-outline'"
              slot="start">
            </ion-icon>
            {{ isOnline ? 'Guardar en servidor' : 'Guardar localmente' }}
          </ion-button>
        </ion-card-content>
      </ion-card>
    </ion-content>
  `
})
export class HomePage implements OnInit {

  newTask: Partial<TaskItem> = { title: '', description: '' };
  isOnline: boolean = true;
  pendingCount: number = 0;

  private readonly API_URL = 'https://api.example.com/tasks';

  constructor(
    private offlineStorage: OfflineStorageService,
    private networkService: NetworkService,
    private toastCtrl: ToastController
  ) {}

  ngOnInit(): void {
    // Suscribirse al estado de red para actualizar el botón
    this.networkService.getOnlineStatus().subscribe(online => {
      this.isOnline = online;
    });

    // Suscribirse al contador de pendientes para el badge
    this.offlineStorage.getPendingCount().subscribe(count => {
      this.pendingCount = count;
    });
  }

  /**
   * Guarda la tarea.
   * El servicio decide automáticamente si enviar al servidor
   * o guardar localmente según el estado de la conexión.
   */
  async saveTask(): Promise<void> {
    if (!this.newTask.title?.trim()) {
      await this.showToast('El título es obligatorio', 'warning');
      return;
    }

    const task: TaskItem = {
      title: this.newTask.title,
      description: this.newTask.description || '',
      createdAt: new Date().toISOString()
    };

    try {
      // ⬇️ Una sola llamada — el servicio maneja online/offline internamente
      await this.offlineStorage.saveData(this.API_URL, task, 'POST');

      const msg = this.isOnline
        ? 'Tarea guardada en el servidor ✓'
        : 'Tarea guardada localmente — se sincronizará al reconectar';

      await this.showToast(msg, this.isOnline ? 'success' : 'warning');
      this.newTask = { title: '', description: '' };   // Limpiar formulario

    } catch (error) {
      await this.showToast('Error al guardar la tarea', 'danger');
    }
  }

  private async showToast(message: string, color: string): Promise<void> {
    const toast = await this.toastCtrl.create({
      message,
      duration: 3000,
      position: 'bottom',
      color
    });
    await toast.present();
  }
}
