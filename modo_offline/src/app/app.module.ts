/**
 * ============================================================
 * app.module.ts  ─  Configuración del módulo (Entregable 2)
 * ============================================================
 * Configuración completa del módulo Angular con todos los
 * imports necesarios para el modo offline.
 *
 * INSTALACIÓN COMPLETA:
 *   npm install @capacitor/network
 *   npm install @ionic/storage-angular
 *   npx cap sync
 * ============================================================
 */

import { NgModule } from '@angular/core';
import { BrowserModule } from '@angular/platform-browser';
import { FormsModule } from '@angular/forms';
import { HttpClientModule } from '@angular/common/http';
import { IonicModule } from '@ionic/angular';

// ── @ionic/storage-angular ────────────────────────────────────
// IonicStorageModule.forRoot() configura el storage con drivers
// en el siguiente orden de preferencia:
//   1. SQLite (Capacitor nativo - iOS/Android)
//   2. IndexedDB (PWA / Navegador)
//   3. localStorage  (Fallback final)
import { IonicStorageModule } from '@ionic/storage-angular';

import { AppRoutingModule } from './app-routing.module';
import { AppComponent } from './app.component';
import { HomePage } from './pages/home/home.page';
import { OfflineBannerComponent } from './components/offline-banner/offline-banner.component';
import { NetworkStatusComponent } from './components/network-status/network-status.component';

@NgModule({
  declarations: [
    AppComponent,
    HomePage,
    OfflineBannerComponent,    // 👈 Banner de modo offline
    NetworkStatusComponent,    // 👈 Indicador visual de red
  ],
  imports: [
    BrowserModule,
    FormsModule,               // Para [(ngModel)] en los formularios
    HttpClientModule,          // Para peticiones HTTP al servidor
    IonicModule.forRoot(),
    IonicStorageModule.forRoot({
      // Nombre de la base de datos SQLite / IndexedDB
      name: '__ap4_offline_db',
      // Drivers en orden de preferencia
      driverOrder: ['sqlite', 'indexeddb', 'localstorage']
    }),
    AppRoutingModule,
  ],
  bootstrap: [AppComponent],
})
export class AppModule {}
