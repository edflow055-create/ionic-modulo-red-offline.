/**
 * ============================================================
 * app.module.ts  ─  Fragmento relevante (Entregable 1)
 * ============================================================
 * Muestra cómo registrar el NetworkStatusComponent y el
 * NetworkService en el módulo principal de Angular.
 *
 * INSTALACIÓN PREVIA:
 *   npm install @capacitor/network
 *   npx cap sync android
 *   npx cap sync ios
 * ============================================================
 */

import { NgModule } from '@angular/core';
import { BrowserModule } from '@angular/platform-browser';
import { IonicModule } from '@ionic/angular';
import { HttpClientModule } from '@angular/common/http';

import { AppRoutingModule } from './app-routing.module';
import { AppComponent } from './app.component';

// Componente del indicador visual de red
import { NetworkStatusComponent } from './components/network-status/network-status.component';

// El NetworkService usa providedIn: 'root' → no necesita declararse aquí

@NgModule({
  declarations: [
    AppComponent,
    NetworkStatusComponent,   // 👈 Registrar el componente visual
  ],
  imports: [
    BrowserModule,
    IonicModule.forRoot(),
    AppRoutingModule,
    HttpClientModule,         // Necesario para las peticiones HTTP en sync
  ],
  bootstrap: [AppComponent],
})
export class AppModule {}


/* ============================================================
   CONFIGURACIÓN ANDROID — android/app/src/main/AndroidManifest.xml
   ============================================================
   Agregar los permisos de red ANTES de la etiqueta <application>:

   <uses-permission android:name="android.permission.INTERNET" />
   <uses-permission android:name="android.permission.ACCESS_NETWORK_STATE" />
   <uses-permission android:name="android.permission.CHANGE_NETWORK_STATE" />
   <uses-permission android:name="android.permission.ACCESS_WIFI_STATE" />

   NOTAS:
   - ACCESS_NETWORK_STATE → detectar si hay conexión activa
   - ACCESS_WIFI_STATE → identificar si el tipo de conexión es WiFi
   - INTERNET → requerido para cualquier petición de red
   ============================================================ */


/* ============================================================
   USO EN app.component.html
   ============================================================
   Agregar el componente al layout principal para que sea
   visible en todas las páginas:

   <app-network-status></app-network-status>
   <ion-app>
     <ion-router-outlet></ion-router-outlet>
   </ion-app>
   ============================================================ */
