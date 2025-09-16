import { Component, OnInit, OnDestroy } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { HttpClient } from '@angular/common/http';
import { ReportesService, Reporte } from '../../services/reportes.service';
import { Subscription } from 'rxjs';

@Component({
  selector: 'app-reportes',
  standalone: true,
  imports: [CommonModule, FormsModule],  template: `
    <div class="reportes-container">
      <!-- 📖 EXPLICACIÓN DEL SISTEMA DE REPORTES -->
      <div class="explicacion-sistema">
        <div class="explicacion-header">
          <div class="icono-explicacion">
            <i class="fas fa-satellite-dish"></i>
          </div>
          <div class="titulo-explicacion">
            <h3>🌟 Sistema de Reportes Ciudadanos</h3>
            <p>Contribuye al monitoreo en tiempo real de glaciares en la Región de Aysén</p>
          </div>
        </div>
        
        <div class="como-funciona">
          <h4>¿Cómo ayudan tus reportes al sistema de monitoreo?</h4>
          <div class="funciones-grid">
            <div class="funcion-item">
              <i class="fas fa-crosshairs"></i>
              <h5>Triangulación de Datos</h5>
              <p>Tu ubicación exacta y descripción nos permiten enfocar el monitoreo automático en esa zona específica y correlacionar con datos satelitales.</p>
            </div>
            <div class="funcion-item">
              <i class="fas fa-chart-network"></i>
              <h5>Validación Cruzada</h5>
              <p>Comparamos tus observaciones con los datos meteorológicos de OpenMeteo para detectar anomalías y confirmar patrones climáticos.</p>
            </div>
            <div class="funcion-item">
              <i class="fas fa-brain"></i>
              <h5>Mejora de Algoritmos</h5>
              <p>Cada reporte mejora nuestros modelos de predicción y sistemas de alerta temprana para la conservación glaciar.</p>
            </div>
          </div>
        </div>
      </div>

      <!-- 📝 FORMULARIO PRINCIPAL -->
      <div class="formulario-principal">
        <div class="header-formulario">
          <h3>
            <i class="fas fa-edit"></i>
            Crear Nuevo Reporte
          </h3>
          <div class="indicador-importancia">
            <i class="fas fa-star"></i>
            <span>Tu observación es valiosa</span>
          </div>
        </div>

        <!-- 💬 Mensaje de resultado -->
        <div *ngIf="mensajeResultado" class="mensaje-resultado" 
             [class.exito]="mensajeResultado.includes('exitosamente')"
             [class.error]="mensajeResultado.includes('Error')">
          <i class="fas" [class.fa-check-circle]="mensajeResultado.includes('exitosamente')"
                      [class.fa-exclamation-triangle]="mensajeResultado.includes('Error')"></i>
          {{ mensajeResultado }}
        </div>

        <form (ngSubmit)="enviarReporte()" class="formulario-moderno">
          <!-- 🏷️ Tipo y Prioridad -->
          <div class="seccion-formulario">
            <h4><i class="fas fa-tags"></i> Clasificación del Reporte</h4>
            <div class="form-grid">
              <div class="form-group">
                <label>Tipo de observación</label>
                <select [(ngModel)]="nuevoReporte.tipo" name="tipo" required class="select-moderno">
                  <option value="observacion">🔍 Observación General</option>
                  <option value="alerta">⚠️ Situación de Alerta</option>
                  <option value="medicion">📊 Medición Específica</option>
                  <option value="incidente">🚨 Incidente Crítico</option>
                </select>
              </div>

              <div class="form-group">
                <label>Nivel de urgencia</label>
                <div class="prioridad-visual">
                  <label class="radio-visual" [class.selected]="nuevoReporte.prioridad === 'baja'">
                    <input type="radio" [(ngModel)]="nuevoReporte.prioridad" name="prioridad" value="baja">
                    <div class="radio-content baja">
                      <i class="fas fa-circle"></i>
                      <span>Baja</span>
                    </div>
                  </label>
                  <label class="radio-visual" [class.selected]="nuevoReporte.prioridad === 'media'">
                    <input type="radio" [(ngModel)]="nuevoReporte.prioridad" name="prioridad" value="media">
                    <div class="radio-content media">
                      <i class="fas fa-circle"></i>
                      <span>Media</span>
                    </div>
                  </label>
                  <label class="radio-visual" [class.selected]="nuevoReporte.prioridad === 'alta'">
                    <input type="radio" [(ngModel)]="nuevoReporte.prioridad" name="prioridad" value="alta">
                    <div class="radio-content alta">
                      <i class="fas fa-circle"></i>
                      <span>Alta</span>
                    </div>
                  </label>
                  <label class="radio-visual" [class.selected]="nuevoReporte.prioridad === 'critica'">
                    <input type="radio" [(ngModel)]="nuevoReporte.prioridad" name="prioridad" value="critica">
                    <div class="radio-content critica">
                      <i class="fas fa-circle"></i>
                      <span>Crítica</span>
                    </div>
                  </label>
                </div>
              </div>
            </div>
          </div>

          <!-- 📝 Descripción del Evento -->
          <div class="seccion-formulario">
            <h4><i class="fas fa-comment-alt"></i> Descripción del Evento</h4>
            
            <div class="form-group">
              <label>Título descriptivo</label>
              <input type="text" [(ngModel)]="nuevoReporte.titulo" name="titulo" 
                     placeholder="Ej: Deshielo acelerado observado en Glaciar San Rafael"
                     class="input-moderno" required>
              <small class="ayuda-texto">
                <i class="fas fa-lightbulb"></i>
                Sé específico: incluye el fenómeno observado y ubicación aproximada
              </small>
            </div>

            <div class="form-group">
              <label>Descripción detallada</label>
              <textarea [(ngModel)]="nuevoReporte.descripcion" name="descripcion" 
                        placeholder="Describe lo que observaste: condiciones climáticas, cambios en el glaciar, temperatura aproximada, velocidad de deshielo, color del agua, etc. Mientras más detalles, mejor podremos triangular los datos automáticos con tu observación."
                        rows="5" class="textarea-moderno" required></textarea>
              <div class="contador-caracteres">
                {{ nuevoReporte.descripcion.length || 0 }} caracteres
              </div>
            </div>
          </div>

          <!-- 📍 Ubicación Precisa -->
          <div class="seccion-formulario destacada">
            <h4><i class="fas fa-map-marker-alt"></i> Ubicación Precisa</h4>
            <div class="ubicacion-info">
              <i class="fas fa-info-circle"></i>
              <p><strong>Muy importante:</strong> La ubicación exacta nos permite enfocar nuestros sensores automáticos y validar datos meteorológicos en esa zona específica para correlacionar con tu observación.</p>
            </div>
            
            <div class="form-grid">
              <div class="form-group">
                <label>Latitud (Coordenada Norte-Sur)</label>
                <input type="number" [(ngModel)]="nuevoReporte.ubicacion.latitud" 
                       name="latitud" step="0.000001" class="input-moderno input-coordenada" required
                       placeholder="-45.594500">
              </div>
              <div class="form-group">
                <label>Longitud (Coordenada Este-Oeste)</label>
                <input type="number" [(ngModel)]="nuevoReporte.ubicacion.longitud" 
                       name="longitud" step="0.000001" class="input-moderno input-coordenada" required
                       placeholder="-72.070800">
              </div>
            </div>

            <div class="acciones-ubicacion">
              <button type="button" (click)="obtenerUbicacion()" class="btn-ubicacion-moderna" [disabled]="obteniendoUbicacion">
                <i class="fas" [class.fa-crosshairs]="!obteniendoUbicacion" [class.fa-spinner]="obteniendoUbicacion" [class.fa-spin]="obteniendoUbicacion"></i>
                {{ obteniendoUbicacion ? 'Obteniendo ubicación...' : 'Usar mi ubicación actual' }}
              </button>
              <small class="ubicacion-actual" *ngIf="ubicacionObtenida">
                <i class="fas fa-check-circle"></i>
                Ubicación actualizada correctamente
              </small>
            </div>
          </div>

          <!-- 📷 Evidencia Visual -->
          <div class="seccion-formulario">
            <h4><i class="fas fa-camera"></i> Evidencia Visual (Opcional)</h4>
            
            <div class="zona-archivos" 
                 [class.drag-over]="dragging"
                 (dragover)="onDragOver($event)"
                 (dragenter)="onDragEnter($event)"
                 (dragleave)="onDragLeave($event)"
                 (drop)="onDrop($event)"
                 (click)="inputArchivo.click()">
              
              <input #inputArchivo type="file" (change)="onFileSelected($event)" 
                     accept="image/*" multiple style="display: none;">
              
              <div class="contenido-zona-archivos" *ngIf="archivosSeleccionados.length === 0">
                <i class="fas fa-cloud-upload-alt"></i>
                <p>📸 Arrastra imágenes aquí o haz clic para seleccionar</p>
                <small>Formatos aceptados: JPG, PNG, GIF, WEBP (máx. 5MB cada una)</small>
              </div>
              
              <div class="archivos-seleccionados" *ngIf="archivosSeleccionados.length > 0">
                <div *ngFor="let archivo of archivosSeleccionados; let i = index" class="archivo-item">
                  <i class="fas fa-image"></i>
                  <span>{{ archivo.name }}</span>
                  <small>({{ (archivo.size / 1024 / 1024).toFixed(2) }} MB)</small>
                  <button type="button" (click)="eliminarArchivo(i)" class="btn-eliminar-archivo">
                    <i class="fas fa-times"></i>
                  </button>
                </div>
                <button type="button" (click)="inputArchivo.click()" class="btn-agregar-mas">
                  <i class="fas fa-plus"></i>
                  Agregar más imágenes
                </button>
              </div>
            </div>
          </div>

          <!-- 👤 Información del Reportero -->
          <div class="seccion-formulario">
            <h4><i class="fas fa-user-circle"></i> Información del Reportero</h4>
            
            <div class="form-group">
              <label>Tu nombre completo</label>
              <input type="text" [(ngModel)]="nuevoReporte.autor.nombre" name="autorNombre" 
                     placeholder="Ej: María González Pérez"
                     class="input-moderno" required>
              <small class="ayuda-texto">
                <i class="fas fa-shield-alt"></i>
                Tu información se mantiene confidencial y solo se usa para validación de reportes
              </small>
            </div>

            <div class="form-group">
              <label>Email de contacto (opcional)</label>
              <input type="email" [(ngModel)]="nuevoReporte.autor.email" name="autorEmail" 
                     placeholder="correo@ejemplo.com"
                     class="input-moderno">
              <small class="ayuda-texto">
                📧 Solo si quieres recibir actualizaciones sobre el estado de tu reporte
              </small>
            </div>
          </div>

          <!-- 🎬 Botones de Acción -->
          <div class="acciones-formulario">
            <button type="button" (click)="limpiarFormulario()" class="btn-secundario">
              <i class="fas fa-eraser"></i>
              Limpiar formulario
            </button>
            <button type="submit" [disabled]="enviandoReporte || !formularioValido()" class="btn-principal">
              <i class="fas" [class.fa-paper-plane]="!enviandoReporte" [class.fa-spinner]="enviandoReporte" [class.fa-spin]="enviandoReporte"></i>
              {{ enviandoReporte ? 'Enviando reporte...' : '🚀 Enviar reporte' }}
            </button>
          </div>
        </form>
      </div>

      <!-- 📋 LISTA DE REPORTES RECIENTES -->
      <div class="reportes-recientes" *ngIf="reportes.length > 0">
        <div class="header-recientes">
          <h3>
            <i class="fas fa-history"></i>
            Reportes Recientes de la Comunidad
          </h3>
          <div class="filtros-compactos">
            <select [(ngModel)]="filtroTipo" (change)="aplicarFiltros()" class="filtro-select">
              <option value="">🌐 Todos los tipos</option>
              <option value="observacion">🔍 Observaciones</option>
              <option value="alerta">⚠️ Alertas</option>
              <option value="medicion">📊 Mediciones</option>
              <option value="incidente">🚨 Incidentes</option>
            </select>
          </div>
        </div>

        <div class="lista-reportes-compacta">
          <div *ngFor="let reporte of reportesFiltrados.slice(0, mostrarTodosReportes ? reportesFiltrados.length : 5)" class="reporte-compacto">
            <div class="reporte-indicadores">
              <div class="tipo-indicador" [class]="'tipo-' + reporte.tipo" 
                   [title]="'Tipo: ' + reporte.tipo"></div>
              <div class="prioridad-indicador" [class]="'prioridad-' + reporte.prioridad"
                   [title]="'Prioridad: ' + reporte.prioridad"></div>
            </div>
            <div class="reporte-info">
              <h5>{{ reporte.titulo }}</h5>
              <p>{{ reporte.descripcion | slice:0:150 }}{{ reporte.descripcion.length > 150 ? '...' : '' }}</p>
              <div class="reporte-meta">
                <span class="fecha">
                  <i class="fas fa-clock"></i>
                  {{ reporte.fecha | date:'dd/MM/yy HH:mm' }}
                </span>
                <span class="autor">
                  <i class="fas fa-user"></i>
                  {{ reporte.autor.nombre }}
                </span>
                <span class="ubicacion">
                  <i class="fas fa-map-marker-alt"></i>
                  {{ reporte.ubicacion.latitud | number:'1.4-4' }}, {{ reporte.ubicacion.longitud | number:'1.4-4' }}
                </span>
              </div>
            </div>
            <div class="reporte-estado">
              <span class="estado-badge" [class]="'estado-' + reporte.estado">
                {{ getEstadoTexto(reporte.estado) }}
              </span>
            </div>
          </div>

          <div *ngIf="reportesFiltrados.length === 0" class="sin-reportes">
            <i class="fas fa-search"></i>
            <p>No se encontraron reportes con el filtro seleccionado</p>
            <small>Intenta cambiar el filtro o crear el primer reporte de este tipo</small>
          </div>

          <div *ngIf="reportesFiltrados.length > 5" class="ver-mas">
            <button (click)="mostrarTodosReportes = !mostrarTodosReportes" class="btn-ver-mas">
              {{ mostrarTodosReportes ? '📦 Ver menos' : '📄 Ver todos (' + reportesFiltrados.length + ')' }}
              <i class="fas" [class.fa-chevron-down]="!mostrarTodosReportes" [class.fa-chevron-up]="mostrarTodosReportes"></i>
            </button>
          </div>
        </div>
      </div>

      <!-- 🌟 Estado inicial sin reportes -->
      <div class="estado-inicial" *ngIf="reportes.length === 0">
        <i class="fas fa-clipboard-list"></i>
        <h4>¡Sé el primero en reportar!</h4>
        <p>Tu observación puede ser clave para detectar cambios importantes en los glaciares de la Región de Aysén. Ayúdanos a construir una red de monitoreo ciudadano.</p>
        <br>
        <small>🌍 Cada reporte contribuye a la ciencia ciudadana y conservación glaciar</small>
      </div>
    </div>
  `,
  styleUrl: './reportes.component.scss'
})
export class ReportesComponent implements OnInit, OnDestroy {
  reportes: Reporte[] = [];
  reportesFiltrados: Reporte[] = [];
  mensajeResultado = '';
  enviandoReporte = false;
  filtroTipo: string = '';
  archivosSeleccionados: File[] = [];
  
  // Nuevas propiedades para la UI mejorada
  obteniendoUbicacion = false;
  ubicacionObtenida = false;
  dragging = false;
  mostrarTodosReportes = false;

  nuevoReporte: Reporte = {
    id: '',
    tipo: 'observacion',
    titulo: '',
    descripcion: '',
    ubicacion: {
      latitud: -45.5945,
      longitud: -72.0708,
      nombre: 'Región de Aysén'
    },
    autor: {
      nombre: '',
      email: '',
      organizacion: ''
    },
    fecha: new Date(),
    estado: 'pendiente',
    prioridad: 'baja',
    imagenes: []
  };

  private subscription = new Subscription();

  constructor(
    private reportesService: ReportesService,
    private http: HttpClient
  ) {}

  ngOnInit() {
    console.log('📋 Sistema de reportes inicializado');
    this.cargarReportes();
  }

  ngOnDestroy() {
    this.subscription.unsubscribe();
  }

  cargarReportes() {
    this.subscription.add(
      this.reportesService.obtenerReportes().subscribe({
        next: (reportes) => {
          this.reportes = reportes;
          this.aplicarFiltros();
          console.log(`📊 Cargados ${reportes.length} reportes`);
        },
        error: (error) => {
          console.error('Error cargando reportes:', error);
          this.mensajeResultado = 'Error al cargar reportes';
          setTimeout(() => this.mensajeResultado = '', 3000);
        }
      })
    );
  }
  enviarReporte(): void {
    if (this.enviandoReporte || !this.formularioValido()) return;

    this.enviandoReporte = true;
    this.nuevoReporte.id = Date.now().toString();
    this.nuevoReporte.fecha = new Date();

    // Adjuntar imágenes seleccionadas
    if (this.archivosSeleccionados.length > 0) {
      this.nuevoReporte.imagenes = this.archivosSeleccionados.map(f => f.name);
    } else {
      this.nuevoReporte.imagenes = [];
    }

    this.subscription.add(
      this.reportesService.crearReporte(this.nuevoReporte).subscribe({
        next: (reporte) => {
          this.mensajeResultado = '✅ Reporte enviado exitosamente. ¡Gracias por tu contribución!';
          this.reportes.unshift(reporte);
          this.aplicarFiltros();
          this.limpiarFormulario();
          this.enviandoReporte = false;
          setTimeout(() => this.mensajeResultado = '', 5000);
          
          // Scroll hacia arriba para mostrar el mensaje
          window.scrollTo({ top: 0, behavior: 'smooth' });
        },
        error: (error) => {
          this.mensajeResultado = '❌ Error al enviar el reporte. Por favor, intenta nuevamente.';
          this.enviandoReporte = false;
          console.error('Error enviando reporte:', error);
          setTimeout(() => this.mensajeResultado = '', 5000);
        }
      })
    );
  }

  private resetearFormulario(): void {
    this.nuevoReporte = {
      id: '',
      tipo: 'observacion',
      titulo: '',
      descripcion: '',
      ubicacion: {
        latitud: -45.5945,
        longitud: -72.0708,
        nombre: 'Región de Aysén'
      },
      autor: {
        nombre: '',
        email: '',
        organizacion: ''
      },
      fecha: new Date(),
      estado: 'pendiente',
      prioridad: 'media',
      imagenes: []
    };
    this.archivosSeleccionados = [];
  }

  // Nuevos métodos para la UI mejorada
  formularioValido(): boolean {
    return !!(this.nuevoReporte.titulo?.trim() && 
              this.nuevoReporte.descripcion?.trim() && 
              this.nuevoReporte.autor.nombre?.trim() &&
              this.nuevoReporte.ubicacion.latitud &&
              this.nuevoReporte.ubicacion.longitud);
  }

  limpiarFormulario(): void {
    this.resetearFormulario();
    this.archivosSeleccionados = [];
    this.ubicacionObtenida = false;
    this.mensajeResultado = '';
  }

  obtenerUbicacion(): void {
    if (navigator.geolocation) {
      this.obteniendoUbicacion = true;
      navigator.geolocation.getCurrentPosition(
        (position) => {
          this.nuevoReporte.ubicacion.latitud = position.coords.latitude;
          this.nuevoReporte.ubicacion.longitud = position.coords.longitude;
          this.ubicacionObtenida = true;
          this.obteniendoUbicacion = false;
          this.mensajeResultado = 'Ubicación obtenida correctamente';
          setTimeout(() => this.mensajeResultado = '', 2000);
        },
        (error) => {
          console.error('Error obteniendo ubicación:', error);
          this.obteniendoUbicacion = false;
          this.mensajeResultado = 'Error al obtener la ubicación. Ingresa las coordenadas manualmente.';
          setTimeout(() => this.mensajeResultado = '', 4000);
        },
        {
          enableHighAccuracy: true,
          timeout: 10000,
          maximumAge: 300000
        }
      );
    } else {
      this.mensajeResultado = 'Geolocalización no soportada en este navegador';
      setTimeout(() => this.mensajeResultado = '', 3000);
    }
  }

  // Métodos para drag and drop de archivos
  onDragOver(event: DragEvent): void {
    event.preventDefault();
    event.stopPropagation();
  }

  onDragEnter(event: DragEvent): void {
    event.preventDefault();
    event.stopPropagation();
    this.dragging = true;
  }

  onDragLeave(event: DragEvent): void {
    event.preventDefault();
    event.stopPropagation();
    this.dragging = false;
  }

  onDrop(event: DragEvent): void {
    event.preventDefault();
    event.stopPropagation();
    this.dragging = false;

    const files = event.dataTransfer?.files;
    if (files && files.length > 0) {
      this.procesarArchivos(Array.from(files));
    }
  }

  onFileSelected(event: any): void {
    const files = event.target.files;
    if (files && files.length > 0) {
      this.procesarArchivos(Array.from(files));
    }
  }

  private procesarArchivos(files: File[]): void {
    const archivosValidos = files.filter(file => {
      // Validar tipo de archivo
      if (!file.type.startsWith('image/')) {
        this.mensajeResultado = `El archivo ${file.name} no es una imagen válida.`;
        setTimeout(() => this.mensajeResultado = '', 3000);
        return false;
      }
      
      // Validar tamaño (5MB máximo)
      if (file.size > 5 * 1024 * 1024) {
        this.mensajeResultado = `El archivo ${file.name} es demasiado grande (máx. 5MB).`;
        setTimeout(() => this.mensajeResultado = '', 3000);
        return false;
      }
      
      return true;
    });

    // Agregar a la lista existente (sin duplicados)
    archivosValidos.forEach(archivo => {
      const existe = this.archivosSeleccionados.some(a => a.name === archivo.name && a.size === archivo.size);
      if (!existe) {
        this.archivosSeleccionados.push(archivo);
      }
    });

    // Límite de 10 archivos
    if (this.archivosSeleccionados.length > 10) {
      this.archivosSeleccionados = this.archivosSeleccionados.slice(0, 10);
      this.mensajeResultado = 'Máximo 10 imágenes permitidas.';
      setTimeout(() => this.mensajeResultado = '', 3000);
    }
  }

  eliminarArchivo(index: number): void {
    this.archivosSeleccionados.splice(index, 1);
  }

  aplicarFiltros(): void {
    if (!this.filtroTipo) {
      this.reportesFiltrados = [...this.reportes];
    } else {
      this.reportesFiltrados = this.reportes.filter(r => r.tipo === this.filtroTipo);
    }
  }

  getEstadoTexto(estado: string): string {
    const estados: { [key: string]: string } = {
      'pendiente': 'Pendiente',
      'en_revision': 'En Revisión',
      'resuelto': 'Resuelto',
      'archivado': 'Archivado'
    };
    return estados[estado] || estado;
  }
}
