import { Component } from '@angular/core';
import { CommonModule } from '@angular/common';
import { RouterModule } from '@angular/router';
import { SidebarLeftComponent } from './components/sidebar-left/sidebar-left.component';
import { MapCentralComponent } from './components/map-central/map-central.component';
import { SidebarRightComponent } from './components/sidebar-right/sidebar-right.component';

@Component({
  selector: 'app-simulador',
  template: `
    <div class="dashboard-container">
      <app-sidebar-left class="sidebar-left"></app-sidebar-left>
      <app-map-central class="map-central"></app-map-central>
      <app-sidebar-right class="sidebar-right"></app-sidebar-right>
    </div>
  `,
  styleUrls: ['./simulador.component.scss'],
  standalone: true,
  imports: [
    CommonModule,
    RouterModule,
    SidebarLeftComponent,
    MapCentralComponent,
    SidebarRightComponent
  ]
})
export class SimuladorComponent {
  constructor() {
    // Inicialización del simulador de glaciares
  }
}
