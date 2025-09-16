import { Component } from '@angular/core';
import { CommonModule } from '@angular/common';
import { SidebarLeftComponent } from '../sidebar-left/sidebar-left.component';
import { MapCentralComponent } from '../map-central/map-central.component';
import { SidebarRightComponent } from '../sidebar-right/sidebar-right.component';

@Component({
  selector: 'app-dashboard',
  standalone: true,
  imports: [
    CommonModule,
    SidebarLeftComponent,
    MapCentralComponent,
    SidebarRightComponent
  ],
  template: `
    <div class="dashboard-container">
      <app-sidebar-left class="sidebar-left"></app-sidebar-left>
      <app-map-central class="map-central"></app-map-central>
      <app-sidebar-right class="sidebar-right"></app-sidebar-right>
    </div>
  `,
  styleUrls: ['./dashboard.component.scss']
})
export class DashboardComponent {
  constructor() {}
}
