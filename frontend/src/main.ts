import { bootstrapApplication } from '@angular/platform-browser';
import { appConfig } from './app/app.config';
import { AppComponent } from './app/app.component';

// Configurar Cesium
(window as any).CESIUM_BASE_URL = '/assets/cesium/';

bootstrapApplication(AppComponent, appConfig)
  .catch((err) => console.error(err));
