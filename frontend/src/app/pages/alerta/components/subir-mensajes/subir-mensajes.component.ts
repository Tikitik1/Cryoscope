import { Component, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';

@Component({
  selector: 'app-subir-mensajes',
  standalone: true,
  imports: [CommonModule],
  template: `
    <div class="subir-mensajes-container">
      <div class="header">
        <h3>
          <i class="fas fa-clipboard-list"></i>
          Sistema de Reportes
        </h3>
      </div>

      <div class="contenido-preparacion">
        <div class="mensaje-desarrollo">
          <i class="fas fa-tools"></i>
          <h4>Funcionalidad en Desarrollo</h4>
          <p>El sistema de reportes y mensajes se encuentra en preparación.</p>
          <p>Permitirá a los usuarios enviar observaciones y reportes técnicos sobre:</p>
          
          <div class="caracteristicas-futuras">
            <div class="caracteristica">
              <i class="fas fa-eye"></i>
              <span>Observaciones de campo</span>
            </div>
            <div class="caracteristica">
              <i class="fas fa-exclamation-triangle"></i>
              <span>Alertas tempranas</span>
            </div>
            <div class="caracteristica">
              <i class="fas fa-file-alt"></i>
              <span>Reportes técnicos</span>
            </div>
            <div class="caracteristica">
              <i class="fas fa-map-marker-alt"></i>
              <span>Geolocalización de eventos</span>
            </div>
          </div>

          <div class="estado-desarrollo">
            <p><strong>Estado actual:</strong> Preparando sistema de recolección de datos reales</p>
          </div>
        </div>
      </div>
    </div>
  `,
  styleUrls: ['./subir-mensajes.component.scss']
})
export class SubirMensajesComponent implements OnInit {

  constructor() {}

  ngOnInit(): void {
    console.log('📝 Componente de reportes inicializado');
  }
}
