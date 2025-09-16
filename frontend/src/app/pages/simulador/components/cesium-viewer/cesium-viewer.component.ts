import { Component, OnInit, OnDestroy, ElementRef, ViewChild, Input, OnChanges, Output, EventEmitter } from '@angular/core';
import { CommonModule } from '@angular/common';
import * as Cesium from 'cesium';

@Component({
  selector: 'app-cesium-viewer',
  standalone: true,
  imports: [CommonModule],  template: `
    <div class="cesium-container">
      <div #cesiumContainer class="cesium-viewer" [id]="containerId"></div>
    </div>
  `,
  styles: [`    .cesium-container {
      background: white;
      border-radius: 8px;
      box-shadow: 0 4px 12px rgba(0,0,0,0.15);
      overflow: hidden;
      height: 100%;
      display: flex;
      flex-direction: column;
    }

    .cesium-viewer {
      flex: 1;
      min-height: 200px;
      width: 100%;
    }

    /* Ocultar elementos innecesarios de Cesium */
    :host ::ng-deep .cesium-viewer-toolbar,
    :host ::ng-deep .cesium-viewer-fullscreenContainer,
    :host ::ng-deep .cesium-viewer-vrContainer {
      display: none !important;
    }

    :host ::ng-deep .cesium-widget-credits {
      display: none !important;
    }

    :host ::ng-deep .cesium-viewer-bottom {
      display: none !important;
    }

    :host ::ng-deep .cesium-credit-container {
      display: none !important;
    }

    :host ::ng-deep .cesium-widget-credits-container {
      display: none !important;
    }

    /* Ocultar elementos subrayados en azul y otros controles */
    :host ::ng-deep .cesium-navigation-help,
    :host ::ng-deep .cesium-navigation-help-button,
    :host ::ng-deep .cesium-home-button,
    :host ::ng-deep .cesium-sceneModePicker-wrapper,
    :host ::ng-deep .cesium-baseLayerPicker-dropDown,
    :host ::ng-deep .cesium-geocoder,
    :host ::ng-deep .cesium-infoBox,
    :host ::ng-deep .cesium-selection-wrapper {
      display: none !important;
    }

    /* Ocultar cualquier enlace o elemento subrayado */
    :host ::ng-deep a,
    :host ::ng-deep .cesium-button,
    :host ::ng-deep .cesium-toolbar-button {
      display: none !important;
    }

    /* Ocultar elementos de texto con enlaces */
    :host ::ng-deep .cesium-credit-text,
    :host ::ng-deep .cesium-credit-textContainer {
      display: none !important;
    }
  `]
})
export class CesiumViewerComponent implements OnInit, OnDestroy, OnChanges {
  @ViewChild('cesiumContainer', { static: true }) cesiumContainer!: ElementRef;
  @Input() glaciarData: any = null;
  @Input() isVisible: boolean = false;

  private viewer: Cesium.Viewer | null = null;
  private glaciarEntity: Cesium.Entity | null = null;
  containerId: string;
  constructor() {
    this.containerId = `cesium-container-${Math.random().toString(36).substring(2, 15)}`;
    
    // Configurar el token de Cesium solo si es necesario
    if (typeof Cesium !== 'undefined' && Cesium.Ion) {
      Cesium.Ion.defaultAccessToken = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJqdGkiOiJhOTAxZTg0NS04NjkwLTQ2MjgtOTJhOC1jMmMzNDQ5NWFkZTIiLCJpZCI6MzEyMDg4LCJpYXQiOjE3NDk4ODIzNjJ9.cWqQ5o4tjv1X40Exvk5dvJwUVu_xb_CcPzAXO9j9fYo';
    }
  }  ngOnInit(): void {
    if (this.isVisible) {
      setTimeout(async () => {
        try {
          await this.initializeCesium();
        } catch (error) {
          console.log('Cesium initialization failed in ngOnInit, showing alternative view');
          this.showAlternative3DView();
        }
      }, 300);
    }
  }ngOnChanges(): void {
    if (this.isVisible && !this.viewer) {
      // Intentar inicializar con timeout más largo para asegurar que el DOM esté listo
      setTimeout(async () => {
        try {
          await this.initializeCesium();
        } catch (error) {
          console.log('Cesium initialization failed, showing alternative view');
          this.showAlternative3DView();
        }
      }, 200);
    } else if (this.isVisible && this.viewer && this.glaciarData) {
      this.loadGlaciarData();
    } else if (!this.isVisible && this.viewer) {
      // Limpiar el viewer cuando no es visible para evitar errores
      try {
        this.viewer.destroy();
        this.viewer = null;
      } catch (e) {
        console.log('Error destroying viewer:', e);
      }
    }
  }

  ngOnDestroy(): void {
    if (this.viewer) {
      this.viewer.destroy();
      this.viewer = null;
    }  }

  private async initializeCesium(): Promise<void> {
    if (this.viewer) return;

    try {      // Intentar inicializar Cesium con configuración mínima
      this.viewer = new Cesium.Viewer(this.cesiumContainer.nativeElement, {
        terrainProvider: new Cesium.EllipsoidTerrainProvider(),
        homeButton: false,
        sceneModePicker: false,
        baseLayerPicker: false,
        navigationHelpButton: false,
        animation: false,
        timeline: false,
        fullscreenButton: false,
        vrButton: false,
        geocoder: false,
        infoBox: false,
        selectionIndicator: false,
        shadows: false,
        terrainShadows: Cesium.ShadowMode.DISABLED,
        creditContainer: document.createElement('div'), // Container oculto para créditos
        shouldAnimate: false
      });

      // Configuración mínima
      this.viewer.scene.globe.enableLighting = false;
      this.viewer.scene.fog.enabled = false;
      this.viewer.scene.backgroundColor = Cesium.Color.LIGHTSTEELBLUE;      // Ocultar completamente los créditos y elementos adicionales
      if (this.viewer.cesiumWidget.creditContainer) {
        (this.viewer.cesiumWidget.creditContainer as HTMLElement).style.display = 'none';
      }

      // Remover elementos adicionales de la interfaz
      setTimeout(() => {
        // Buscar y ocultar cualquier elemento con enlaces o subrayado
        const cesiumContainer = this.cesiumContainer.nativeElement;
        const links = cesiumContainer.querySelectorAll('a');
        links.forEach((link: any) => {
          link.style.display = 'none';
        });

        // Ocultar elementos de créditos específicos
        const credits = cesiumContainer.querySelectorAll('.cesium-credit-text, .cesium-credit-textContainer');
        credits.forEach((credit: any) => {
          credit.style.display = 'none';
        });

        // Ocultar cualquier elemento subrayado
        const underlined = cesiumContainer.querySelectorAll('*');
        underlined.forEach((el: any) => {
          if (el.style.textDecoration === 'underline' || 
              getComputedStyle(el).textDecoration.includes('underline')) {
            el.style.display = 'none';
          }
        });
      }, 500);

      // No intentar modificar el skybox, dejarlo como está por defecto
      // Esto evita el error de rendering

      if (this.glaciarData) {
        this.loadGlaciarData();
      }
    } catch (error) {
      console.error('Error inicializando Cesium:', error);
      // Fallback: mostrar visualización alternativa
      this.showAlternative3DView();
    }
  }

  private showAlternative3DView(): void {
    const container = this.cesiumContainer.nativeElement;
    container.innerHTML = `
      <div style="
        display: flex;
        flex-direction: column;
        align-items: center;
        justify-content: center;
        height: 100%;
        background: linear-gradient(135deg, #87CEEB 0%, #4682B4 50%, #2F4F4F 100%);
        color: white;
        text-align: center;
        padding: 20px;
        position: relative;
        overflow: hidden;
      ">
        <div style="
          position: absolute;
          width: 200%;
          height: 200%;
          background: url('data:image/svg+xml,<svg xmlns=\\"http://www.w3.org/2000/svg\\" viewBox=\\"0 0 100 100\\"><polygon fill=\\"white\\" opacity=\\"0.1\\" points=\\"20,80 50,20 80,80\\"/><polygon fill=\\"white\\" opacity=\\"0.08\\" points=\\"10,90 30,50 50,90\\"/><polygon fill=\\"white\\" opacity=\\"0.12\\" points=\\"60,90 80,30 90,90\\"/></svg>');
          background-size: 100px 100px;
          animation: float 6s ease-in-out infinite;
          z-index: 1;
        "></div>
        <div style="position: relative; z-index: 2;">
          <div style="font-size: 3em; margin-bottom: 15px; text-shadow: 2px 2px 4px rgba(0,0,0,0.3);">🏔️</div>
          <h3 style="margin: 0 0 10px 0; font-size: 1.2em;">Vista 3D - ${this.glaciarData?.nombre || 'Glaciar'}</h3>
          <div style="background: rgba(255,255,255,0.2); border-radius: 8px; padding: 12px; margin: 10px 0;">
            <p style="margin: 5px 0; font-size: 0.9em;"><strong>Área:</strong> ${this.glaciarData?.area_km2?.toFixed(2) || 0} km²</p>
            <p style="margin: 5px 0; font-size: 0.9em;"><strong>Altura máxima:</strong> ${this.glaciarData?.altura_maxima_m || 'N/A'} m</p>
            <p style="margin: 5px 0; font-size: 0.9em;"><strong>Coordenadas:</strong> ${this.glaciarData?.latitud?.toFixed(4) || 0}°, ${this.glaciarData?.longitud?.toFixed(4) || 0}°</p>
          </div>
          <div style="margin-top: 15px; font-size: 0.8em; opacity: 0.9;">
            🌐 Representación interactiva del glaciar
          </div>
        </div>
        <style>
          @keyframes float {
            0%, 100% { transform: translateY(0px) rotate(0deg); }
            50% { transform: translateY(-10px) rotate(2deg); }
          }
        </style>
      </div>
    `;
  }  private loadGlaciarData(): void {
    if (!this.viewer || !this.glaciarData) return;

    // Limpiar entidades anteriores
    this.viewer.entities.removeAll();

    try {
      // Obtener las coordenadas del glaciar
      const latitud = this.glaciarData.latitud || -45.5;
      const longitud = this.glaciarData.longitud || -72.0;
      const altura = this.glaciarData.altura_media_m || 1000;

      console.log('🏔️ Cargando datos del glaciar en Cesium:', {
        nombre: this.glaciarData.nombre,
        latitud,
        longitud,
        altura,
        tieneGeometria: !!(this.glaciarData.geometria || this.glaciarData.geometry),
        geometriaCompleta: this.glaciarData.geometria || this.glaciarData.geometry
      });

      // Priorizar mostrar la geometría real del shapefile
      if (this.glaciarData.geometria || this.glaciarData.geometry) {
        console.log('✅ Creando polígono 3D con geometría real del shapefile');
        this.createGlaciar3DPolygon();
      } else {
        console.log('⚠️ No hay geometría disponible, mostrando punto de referencia');
        // Solo mostrar punto si no hay geometría disponible
        this.glaciarEntity = this.viewer.entities.add({
          position: Cesium.Cartesian3.fromDegrees(longitud, latitud, altura),
          point: {
            pixelSize: 20,
            color: Cesium.Color.LIGHTBLUE.withAlpha(0.8),
            outlineColor: Cesium.Color.BLUE,
            outlineWidth: 2,
            heightReference: Cesium.HeightReference.CLAMP_TO_GROUND
          },
          label: {
            text: this.glaciarData.nombre || 'Glaciar',
            font: '12pt monospace',
            style: Cesium.LabelStyle.FILL_AND_OUTLINE,
            outlineWidth: 2,
            verticalOrigin: Cesium.VerticalOrigin.BOTTOM,
            pixelOffset: new Cesium.Cartesian2(0, -40),
            fillColor: Cesium.Color.WHITE,
            outlineColor: Cesium.Color.BLACK
          }
        });
      }

      // Volar a la ubicación del glaciar
      this.viewer.camera.flyTo({
        destination: Cesium.Cartesian3.fromDegrees(longitud, latitud, altura + 5000),
        duration: 2.0,
        orientation: {
          heading: Cesium.Math.toRadians(0),
          pitch: Cesium.Math.toRadians(-30),
          roll: 0.0
        }
      });

    } catch (error) {
      console.error('Error cargando datos del glaciar en Cesium:', error);
    }
  }  private createGlaciar3DPolygon(): void {
    if (!this.viewer) return;

    try {
      // Buscar geometría en diferentes propiedades posibles
      const geometry = this.glaciarData.geometria || this.glaciarData.geometry || this.glaciarData.propiedades?.geometria;
      
      console.log('🔍 Buscando geometría del glaciar:', {
        tieneGeometria: !!this.glaciarData.geometria,
        tieneGeometry: !!this.glaciarData.geometry,
        tienePropiedadesGeometria: !!this.glaciarData.propiedades?.geometria,
        geometryType: geometry?.type,
        coordinates: geometry?.coordinates?.length
      });
      
      if (!geometry || !geometry.coordinates) {
        console.warn('⚠️ No se encontró geometría válida para el glaciar');
        this.createFallbackPoint();
        return;
      }

      const coordinates = geometry.coordinates;
      let positions: Cesium.Cartesian3[] = [];
      const alturaBase = this.glaciarData.altura_minima_m || 500;
      const alturaTop = this.glaciarData.altura_maxima_m || 2000;

      console.log('📐 Procesando geometría:', {
        type: geometry.type,
        coordinatesLength: coordinates.length,
        alturaBase,
        alturaTop
      });

      if (geometry.type === 'Polygon') {
        // Para polígonos, tomar el primer anillo (exterior)
        const ring = coordinates[0];
        console.log('🔺 Polígono detectado, procesando anillo con', ring.length, 'puntos');
        positions = ring.map((coord: number[]) => 
          Cesium.Cartesian3.fromDegrees(coord[0], coord[1], alturaBase)
        );
      } else if (geometry.type === 'MultiPolygon') {
        // Para multipolígonos, tomar el primer polígono, primer anillo
        const ring = coordinates[0][0];
        console.log('🔺 MultiPolígono detectado, procesando primer anillo con', ring.length, 'puntos');
        positions = ring.map((coord: number[]) => 
          Cesium.Cartesian3.fromDegrees(coord[0], coord[1], alturaBase)
        );
      }

      if (positions.length > 0) {
        console.log('✅ Creando polígono 3D con', positions.length, 'posiciones');
        
        // Crear el polígono 3D del glaciar con la forma real del shapefile
        this.glaciarEntity = this.viewer.entities.add({
          name: this.glaciarData.nombre || 'Glaciar',
          polygon: {
            hierarchy: positions,
            material: Cesium.Color.LIGHTBLUE.withAlpha(0.8),
            outline: true,
            outlineColor: Cesium.Color.BLUE,
            outlineWidth: 2,
            height: alturaBase,
            extrudedHeight: alturaTop,
            extrudedHeightReference: Cesium.HeightReference.RELATIVE_TO_GROUND
          },
          label: {
            text: this.glaciarData.nombre || 'Glaciar',
            font: '14pt monospace',
            style: Cesium.LabelStyle.FILL_AND_OUTLINE,
            outlineWidth: 2,
            verticalOrigin: Cesium.VerticalOrigin.BOTTOM,
            pixelOffset: new Cesium.Cartesian2(0, -50),
            fillColor: Cesium.Color.WHITE,
            outlineColor: Cesium.Color.BLACK,
            heightReference: Cesium.HeightReference.CLAMP_TO_GROUND
          }
        });

        console.log('✅ Glaciar 3D creado con forma real del shapefile:', this.glaciarData.nombre);
      } else {
        console.warn('⚠️ No se pudieron procesar las coordenadas, usando punto de respaldo');
        this.createFallbackPoint();
      }
    } catch (error) {
      console.error('❌ Error creando polígono 3D del glaciar:', error);
      // Fallback: crear un punto si falla la geometría
      this.createFallbackPoint();
    }
  }

  private createFallbackPoint(): void {
    if (!this.viewer) return;
    
    const latitud = this.glaciarData.latitud || -45.5;
    const longitud = this.glaciarData.longitud || -72.0;
    const altura = this.glaciarData.altura_media_m || 1000;
    
    this.glaciarEntity = this.viewer.entities.add({
      position: Cesium.Cartesian3.fromDegrees(longitud, latitud, altura),
      point: {
        pixelSize: 20,
        color: Cesium.Color.LIGHTBLUE.withAlpha(0.8),
        outlineColor: Cesium.Color.BLUE,
        outlineWidth: 2,
        heightReference: Cesium.HeightReference.CLAMP_TO_GROUND
      },
      label: {
        text: this.glaciarData.nombre || 'Glaciar',
        font: '12pt monospace',
        style: Cesium.LabelStyle.FILL_AND_OUTLINE,
        outlineWidth: 2,
        verticalOrigin: Cesium.VerticalOrigin.BOTTOM,
        pixelOffset: new Cesium.Cartesian2(0, -40),
        fillColor: Cesium.Color.WHITE,
        outlineColor: Cesium.Color.BLACK
      }
    });
  }
}
