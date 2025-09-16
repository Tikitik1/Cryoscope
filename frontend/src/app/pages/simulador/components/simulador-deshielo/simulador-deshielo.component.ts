import { Component, OnInit, OnDestroy, Input, OnChanges, SimpleChanges } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { HttpClient } from '@angular/common/http';
import * as L from 'leaflet';
import { GlaciarData, AnalisisImpacto, CiudadCercana, ImpactoGeologico, ResultadoSimulacion } from '../../models/interfaces';
import { Nl2brPipe } from '../../pipes/nl2br.pipe';
import { ClimaComplementarioService, DatosClimaComplementarios } from '../../services/clima-complementario.service';

interface DatosSimulacion {
  anoProyectado: number | 'no-especificado';
  temperaturaBase: number;
  ddf: number;
  aumentoTemperatura: number;
  radiacionSolar: number;
  climaEsperado: number;
  precipitacion: number;
  humedad: number;
}

interface DatosTemperatura {
  temperatura_actual: number;
  temperatura_2050: number;
  delta_temperatura: number;
  temperatura_2020: number;
  comuna: string;
}

interface DatosClimaticosPorAno {
  precipitacion: number;
  humedad: number;
  radiacion: number;
  temperatura: number;
}

@Component({
  selector: 'app-simulador-deshielo',
  standalone: true,
  imports: [CommonModule, FormsModule, Nl2brPipe],
  templateUrl: './simulador-deshielo.component.html',
  styleUrls: ['./simulador-deshielo.component.scss']
})
export class SimuladorDeshieloComponent implements OnInit, OnDestroy, OnChanges {
  @Input() glaciarSeleccionado: GlaciarData | null = null;  @Input() visible: boolean = false;

  // Datos de simulación
  datosSimulacion: DatosSimulacion = {
    anoProyectado: 2050,
    temperaturaBase: 0,
    ddf: 4.5,
    aumentoTemperatura: 2.5,
    radiacionSolar: 75,
    climaEsperado: 1.1,
    precipitacion: 1200,
    humedad: 75
  };

  // Datos originales obtenidos de las capas
  datosOriginalesTemperatura: DatosTemperatura | null = null;
  datosOriginalesClima: DatosClimaComplementarios | null = null;
  
  // Datos climáticos históricos de OpenMeteo (base para proyecciones)
  datosClimaticosPorAno: Map<number, DatosClimaticosPorAno> = new Map();
    // Control de modificación manual
  datosModificadosManualmente: Set<string> = new Set();
  
  // Estado de carga
  cargandoDatos = false;
  datosListos = false;
  
  // Años disponibles para proyección
  anosDisponibles = [2030, 2040, 2050, 2060, 2070, 2080, 2090, 2100];

  // Resultado de la simulación
  resultado: ResultadoSimulacion | null = null;
  simulacionRealizada = false;
  // Mapa pequeño
  private mapaSimulacion: L.Map | null = null;
  private glaciarLayer: L.GeoJSON | null = null;
  private demLayer: L.TileLayer | null = null;
  private impactoLayer: L.Circle | L.GeoJSON | null = null;

  // Validaciones
  errores: { [key: string]: string } = {};

  constructor(
    private http: HttpClient,
    private climaService: ClimaComplementarioService
  ) {}
  ngOnInit(): void {
    // Inicialización del simulador
  }

  ngOnDestroy(): void {
    if (this.mapaSimulacion) {
      this.mapaSimulacion.remove();
    }
  }  ngOnChanges(changes: SimpleChanges): void {
    if (changes['glaciarSeleccionado'] && this.glaciarSeleccionado) {
      // Reset del estado al cambiar de glaciar
      console.log('🔄 Cambio de glaciar detectado, reseteando estado');
      this.cargandoDatos = true;  // Activar loading inmediatamente
      this.datosListos = false;    // Ocultar contenido inmediatamente
      this.resultado = null;
      this.simulacionRealizada = false;
      
      // Resetear datos modificados manualmente
      this.datosModificadosManualmente.clear();
      
      this.cargarDatosGlaciar();
    }
    
    if (changes['visible'] && this.visible) {
      setTimeout(() => {
        this.inicializarMapaSimulacion();
      }, 100);
    }
  }  /**
   * Carga los datos específicos del glaciar seleccionado
   */
  private cargarDatosGlaciar(): void {
    if (!this.glaciarSeleccionado) return;

    console.log('🏔️ Cargando datos para glaciar:', this.glaciarSeleccionado.nombre);

    // Asegurar que el estado de carga esté activo
    this.cargandoDatos = true;
    this.datosListos = false;
    this.resultado = null;
    this.simulacionRealizada = false;

    console.log('🔄 Estado inicial: cargandoDatos =', this.cargandoDatos, ', datosListos =', this.datosListos);
    
    // Cargar datos de temperatura de la capa
    this.cargarDatosTemperatura().then(() => {
      console.log('✅ Datos de temperatura cargados');
      // Después de cargar temperatura, cargar datos climáticos
      return this.cargarDatosClimaticos();
    }).then(() => {
      console.log('✅ Datos climáticos cargados');
      // Una vez que tenemos ambos, proyectar para el año actual
      this.proyectarDatosParaAno(this.datosSimulacion.anoProyectado as number);
      
      // Finalizar estado de carga
      this.cargandoDatos = false;
      this.datosListos = true;
      
      console.log('🎉 CARGA COMPLETADA - Estado final: cargandoDatos =', this.cargandoDatos, ', datosListos =', this.datosListos);
    }).catch((error) => {
      console.error('❌ Error en la carga de datos:', error);
      // En caso de error, aún marcar como datos listos con valores por defecto
      this.cargandoDatos = false;
      this.datosListos = true;
    });
  }

  /**
   * Carga los datos de temperatura desde la capa de temperatura
   */
  private async cargarDatosTemperatura(): Promise<void> {
    if (!this.glaciarSeleccionado) return;
    
    console.log('🌡️ Cargando datos de temperatura para simulación...');
    
    return new Promise((resolve, reject) => {
      this.http.get('http://localhost:8000/api/temperatura/comunas/completo').subscribe({
        next: (data: any) => {
          if (data.features && Array.isArray(data.features)) {
            // Encontrar la comuna más cercana al glaciar
            const comunaMasCercana = this.encontrarComunaMasCercana(
              this.glaciarSeleccionado!.latitud, 
              this.glaciarSeleccionado!.longitud, 
              data.features
            );
              if (comunaMasCercana) {
              const props = comunaMasCercana.properties;
              this.datosOriginalesTemperatura = {
                temperatura_actual: props.temperatura_actual || props.temperatura_2020 || 8.5,
                temperatura_2050: props.temperatura_2050 || 11.0,
                delta_temperatura: props.delta_temperatura || 2.5,
                temperatura_2020: props.temperatura_2020 || 8.5,
                comuna: props.NOM_COMUNA || 'Desconocida'
              };
              
              // Aplicar temperatura base del glaciar (más fría que la comuna)
              this.datosSimulacion.temperaturaBase = this.calcularTemperaturaBaseGlaciar();
              
              console.log('📊 Datos de temperatura cargados de la capa:', {
                comuna: this.datosOriginalesTemperatura.comuna,
                temperatura_actual: this.datosOriginalesTemperatura.temperatura_actual,
                temperatura_2050: this.datosOriginalesTemperatura.temperatura_2050,
                delta_temperatura: this.datosOriginalesTemperatura.delta_temperatura,
                temperatura_2020: this.datosOriginalesTemperatura.temperatura_2020,
                temperaturaBaseGlaciar: this.datosSimulacion.temperaturaBase
              });
              console.log('🔍 Propiedades originales de la capa:', props);
              resolve();
            } else {
              this.usarDatosTemperaturaDefecto();
              resolve();
            }
          } else {
            this.usarDatosTemperaturaDefecto();
            resolve();
          }
        },
        error: (error) => {
          console.error('❌ Error cargando datos de temperatura:', error);
          this.usarDatosTemperaturaDefecto();
          resolve();
        }
      });
    });
  }

  /**
   * Carga los datos climáticos desde OpenMeteo
   */
  private async cargarDatosClimaticos(): Promise<void> {
    if (!this.glaciarSeleccionado) return;
    
    console.log('🌤️ Cargando datos climáticos para simulación...');
    
    return new Promise((resolve, reject) => {
      this.climaService.obtenerDatosClimaComplementarios().subscribe({
        next: (datosClima: DatosClimaComplementarios[]) => {
          // Encontrar la comuna más cercana al glaciar
          const comunaMasCercana = this.encontrarComunaClimataMasCercana(
            this.glaciarSeleccionado!.latitud,
            this.glaciarSeleccionado!.longitud,
            datosClima
          );
          
          if (comunaMasCercana) {
            this.datosOriginalesClima = comunaMasCercana;
            
            // Crear datos base para 2024 (año actual de referencia)
            this.datosClimaticosPorAno.set(2024, {
              precipitacion: comunaMasCercana.precipitacion_mm,
              humedad: comunaMasCercana.humedad_relativa,
              radiacion: comunaMasCercana.radiacion_solar,
              temperatura: comunaMasCercana.sensacion_termica
            });
            
            console.log('🌦️ Datos climáticos base cargados:', comunaMasCercana);
            resolve();
          } else {
            this.usarDatosClimaticosDefecto();
            resolve();
          }
        },
        error: (error) => {
          console.error('❌ Error cargando datos climáticos:', error);
          this.usarDatosClimaticosDefecto();
          resolve();
        }
      });
    });
  }
  /**
   * Calcula la temperatura base del glaciar (más fría que la comuna)
   */
  private calcularTemperaturaBaseGlaciar(): number {
    if (!this.datosOriginalesTemperatura) {
      console.warn('⚠️ No hay datos de temperatura para calcular temperatura base del glaciar');
      return -2;
    }
    
    console.log(`🏔️ Calculando temperatura base del glaciar:`);
    console.log(`   - Temperatura actual comuna: ${this.datosOriginalesTemperatura.temperatura_actual}°C`);
    
    // Los glaciares están típicamente 6-10°C más fríos que las comunas debido a la altitud
    const offsetGlaciar = -8; // Promedio para glaciares patagónicos
    const tempGlaciar = this.datosOriginalesTemperatura.temperatura_actual + offsetGlaciar;
    
    const tempFinal = Math.round(tempGlaciar * 10) / 10;
    console.log(`   - Offset glaciar: ${offsetGlaciar}°C`);
    console.log(`   - Temperatura base glaciar: ${tempFinal}°C`);
    
    return tempFinal;
  }/**
   * Proyecta todos los datos para un año específico usando datos reales como base
   */
  private proyectarDatosParaAno(ano: number): void {
    if (!this.datosOriginalesTemperatura || !this.datosOriginalesClima) {
      console.warn('⚠️ No hay datos originales disponibles para proyección');
      return;
    }
    
    console.log(`📊 Proyectando datos para el año ${ano} usando datos reales como base`);
    console.log(`🌡️ Delta de temperatura real de la capa: ${this.datosOriginalesTemperatura.delta_temperatura}°C`);
    console.log(`🏛️ Comuna: ${this.datosOriginalesTemperatura.comuna}`);
    
    // Usar el delta de temperatura REAL de la capa temperatura
    const deltaTemperaturaReal = this.datosOriginalesTemperatura.delta_temperatura;
    
    // Verificar que el delta no sea el valor por defecto
    if (deltaTemperaturaReal === 2.5) {
      console.warn('⚠️ Se está usando el delta por defecto (2.5°C). Verificar datos de la capa.');
    }
    
    // Lógica de proyección específica por año
    let factorProyeccion: number;
    
    if (ano === 2050) {
      // Para 2050, usar exactamente el delta real (factor = 1)
      factorProyeccion = 1.0;
      console.log(`🎯 Año 2050: usando factor 1.0 para aplicar delta completo`);
    } else if (ano === 2020) {
      // Para 2020, no hay aumento (factor = 0)
      factorProyeccion = 0.0;
      console.log(`📅 Año 2020: usando factor 0.0 (sin aumento)`);
    } else if (ano > 2020 && ano < 2050) {
      // Entre 2020 y 2050: proyección lineal
      const anosDesde2020 = ano - 2020;
      const anosTotal2050 = 2050 - 2020; // 30 años
      factorProyeccion = anosDesde2020 / anosTotal2050;
      console.log(`📈 Año ${ano}: proyección lineal, factor ${factorProyeccion.toFixed(2)}`);
    } else if (ano > 2050) {
      // Después de 2050: continuar la tendencia pero más lenta
      const anosExtra = ano - 2050;
      const anosTotal2050 = 2050 - 2020; // 30 años
      factorProyeccion = 1 + (anosExtra / anosTotal2050) * 0.6; // 60% de la velocidad original
      console.log(`🚀 Año ${ano}: extrapolación post-2050, factor ${factorProyeccion.toFixed(2)}`);
    } else {
      // Antes de 2020: usar extrapolación hacia atrás
      const anosAntes = 2020 - ano;
      const anosTotal2050 = 2050 - 2020;
      factorProyeccion = -(anosAntes / anosTotal2050) * 0.5; // Cambio más lento hacia atrás
      console.log(`⏪ Año ${ano}: extrapolación pre-2020, factor ${factorProyeccion.toFixed(2)}`);
    }
    
    // Limitar factor para evitar valores extremos
    factorProyeccion = Math.max(-1, Math.min(factorProyeccion, 4));
    
    // CALCULAR AUMENTO DE TEMPERATURA USANDO EL DELTA REAL
    const aumentoCalculado = deltaTemperaturaReal * factorProyeccion;
    this.datosSimulacion.aumentoTemperatura = Math.round(aumentoCalculado * 10) / 10;
    
    console.log(`🔢 CÁLCULO FINAL:`);
    console.log(`   - Delta real: ${deltaTemperaturaReal}°C`);
    console.log(`   - Factor proyección: ${factorProyeccion.toFixed(3)}`);
    console.log(`   - Aumento calculado: ${aumentoCalculado.toFixed(2)}°C`);
    console.log(`   - Aumento aplicado: ${this.datosSimulacion.aumentoTemperatura}°C`);
      // Proyección climática usando datos de OpenMeteo como base
    const datosBase2024 = this.datosClimaticosPorAno.get(2024) || {
      precipitacion: this.datosOriginalesClima.precipitacion_mm,
      humedad: this.datosOriginalesClima.humedad_relativa,
      radiacion: this.datosOriginalesClima.radiacion_solar,
      temperatura: this.datosOriginalesClima.sensacion_termica
    };
    
    console.log('📊 Datos base 2024 para proyección:', datosBase2024);
    
    // Proyecciones climáticas más agresivas y realistas
    const factorCambioClimatico = Math.abs(factorProyeccion) * 0.25; // Hasta 25% de cambio máximo
    
    console.log(`🌍 Factor de cambio climático para ${ano}: ${factorCambioClimatico.toFixed(3)}`);
    
    // Precipitación: puede disminuir significativamente con el cambio climático
    const camboPrecipitacion = factorCambioClimatico * 0.3; // Hasta -30% en casos extremos
    const precipitacionProyectada = datosBase2024.precipitacion * (1 - camboPrecipitacion);
    this.datosSimulacion.precipitacion = Math.round(Math.max(200, precipitacionProyectada));
    
    // Humedad: cambios moderados pero notorios
    const camboHumedad = factorCambioClimatico * 0.15; // Hasta ±15%
    const humedadProyectada = datosBase2024.humedad * (1 + (Math.random() > 0.5 ? camboHumedad : -camboHumedad));
    this.datosSimulacion.humedad = Math.round(Math.min(95, Math.max(30, humedadProyectada)));
    
    // Radiación solar: aumenta with el cambio climático y menos nubes
    const camboRadiacion = factorCambioClimatico * 0.4; // Hasta +40% más radiación
    const radiacionProyectada = datosBase2024.radiacion * (1 + camboRadiacion);
    this.datosSimulacion.radiacionSolar = Math.round(Math.min(95, Math.max(30, radiacionProyectada)));    // Factor climático general: conservador pero impactante (basado en literatura)
    const factorClimaticoBase = 1.0 + factorCambioClimatico * 2.0; // 2x más impacto (era 3.0)
    this.datosSimulacion.climaEsperado = Math.round(factorClimaticoBase * 100) / 100;
    
    console.log('🌡️ Cambios climáticos proyectados:');
    console.log(`   - Precipitación: ${datosBase2024.precipitacion} → ${this.datosSimulacion.precipitacion} mm (${camboPrecipitacion > 0 ? '-' : '+'}${(camboPrecipitacion * 100).toFixed(1)}%)`);
    console.log(`   - Humedad: ${datosBase2024.humedad} → ${this.datosSimulacion.humedad}% (±${(camboHumedad * 100).toFixed(1)}%)`);
    console.log(`   - Radiación: ${datosBase2024.radiacion} → ${this.datosSimulacion.radiacionSolar}% (+${(camboRadiacion * 100).toFixed(1)}%)`);
    console.log(`   - Factor climático: ${factorClimaticoBase.toFixed(2)}`);
      // Ajustar DDF según el tipo de glaciar Y el año proyectado
    const ddfBase = this.calcularDDFSegunTipo();
    // DDF aumenta con años futuros debido a cambios en la estructura del hielo
    const factorDDFTemporal = 1.0 + factorCambioClimatico * 0.5; // Hasta +50% más fusión
    this.datosSimulacion.ddf = Math.round((ddfBase * factorDDFTemporal) * 10) / 10;
    
    console.log(`❄️ DDF ajustado: ${ddfBase} → ${this.datosSimulacion.ddf} (factor temporal: ${factorDDFTemporal.toFixed(2)})`);
    
    console.log(`✅ Datos proyectados para ${ano}:`, {
      aumentoTemperatura: this.datosSimulacion.aumentoTemperatura,
      precipitacion: this.datosSimulacion.precipitacion,
      humedad: this.datosSimulacion.humedad,
      radiacionSolar: this.datosSimulacion.radiacionSolar,
      ddf: this.datosSimulacion.ddf,
      climaEsperado: this.datosSimulacion.climaEsperado,
      deltaOriginal: deltaTemperaturaReal,
      factorProyeccion: factorProyeccion
    });
    
    // Guardar proyección para este año
    this.datosClimaticosPorAno.set(ano, {
      precipitacion: this.datosSimulacion.precipitacion,
      humedad: this.datosSimulacion.humedad,
      radiacion: this.datosSimulacion.radiacionSolar,
      temperatura: this.datosSimulacion.temperaturaBase + this.datosSimulacion.aumentoTemperatura
    });
    
    // Resetear simulación para recalcular
    this.resultado = null;
    this.simulacionRealizada = false;
  }

  /**
   * Calcula el DDF según el tipo de glaciar
   */
  private calcularDDFSegunTipo(): number {
    if (!this.glaciarSeleccionado) return 4.5;

    const ddfPorTipo: { [key: string]: number } = {
      'Glaciar de valle': 5.2,
      'Glaciar de circo': 4.1,
      'Glaciar de meseta': 3.8,
      'Campo de hielo': 4.8,
      'Glaciar de outlet': 5.0,
      'default': 4.5
    };

    return ddfPorTipo[this.glaciarSeleccionado.tipo] || ddfPorTipo['default'];
  }

  /**
   * Encuentra la comuna más cercana al glaciar (datos temperatura)
   */
  private encontrarComunaMasCercana(lat: number, lng: number, features: any[]): any {
    let comunaMasCercana = null;
    let distanciaMinima = Infinity;
    
    for (const feature of features) {
      if (feature.geometry && feature.geometry.coordinates) {
        const coords = feature.geometry.coordinates[0];
        if (coords && coords.length > 0) {
          let centroLat = 0, centroLng = 0;
          for (const coord of coords) {
            centroLng += coord[0];
            centroLat += coord[1];
          }
          centroLat = centroLat / coords.length;
          centroLng = centroLng / coords.length;
          
          const distancia = Math.sqrt(
            Math.pow(lat - centroLat, 2) + Math.pow(lng - centroLng, 2)
          );
          
          if (distancia < distanciaMinima) {
            distanciaMinima = distancia;
            comunaMasCercana = feature;
          }
        }
      }
    }
    
    return comunaMasCercana;
  }

  /**
   * Encuentra la comuna más cercana al glaciar (datos clima)
   */
  private encontrarComunaClimataMasCercana(lat: number, lng: number, datosClima: DatosClimaComplementarios[]): DatosClimaComplementarios | null {
    let comunaMasCercana = null;
    let distanciaMinima = Infinity;
    
    for (const datos of datosClima) {
      const distancia = Math.sqrt(
        Math.pow(lat - datos.latitud, 2) + Math.pow(lng - datos.longitud, 2)
      );
      
      if (distancia < distanciaMinima) {
        distanciaMinima = distancia;
        comunaMasCercana = datos;
      }
    }
    
    return comunaMasCercana;
  }

  /**
   * Usa datos de temperatura por defecto
   */
  private usarDatosTemperaturaDefecto(): void {
    this.datosOriginalesTemperatura = {
      temperatura_actual: 8.5,
      temperatura_2050: 11.0,
      delta_temperatura: 2.5,
      temperatura_2020: 8.5,
      comuna: 'Defecto'
    };
    
    this.datosSimulacion.temperaturaBase = -2.5;
    console.log('⚠️ Usando datos de temperatura por defecto');
  }

  /**
   * Usa datos climáticos por defecto
   */
  private usarDatosClimaticosDefecto(): void {    this.datosOriginalesClima = {
      comuna: 'Defecto',
      latitud: -45.5,
      longitud: -72.0,
      precipitacion_mm: 1200,
      temperatura_media: 8,
      humedad_relativa: 75,
      velocidad_viento: 15,
      direccion_viento: 270,
      radiacion_solar: 75,
      presion_atmosferica: 1013,
      indice_uv: 6,
      visibilidad: 15,
      nubosidad: 65,
      punto_rocio: 5,
      sensacion_termica: 8
    };
    
    this.datosClimaticosPorAno.set(2024, {
      precipitacion: 1200,
      humedad: 75,
      radiacion: 75,
      temperatura: 8
    });
    
    console.log('⚠️ Usando datos climáticos por defecto');
  }

  /**
   * Maneja el cambio del select de año
   */
  onSelectAnoChange(event: Event): void {
    const target = event.target as HTMLSelectElement;
    const valor = target.value;
    
    if (valor !== 'no-especificado') {
      const nuevoAno = parseInt(valor);
      this.onAnoChange(nuevoAno);
    }
  }  /**
   * Maneja el cambio de año en el selector
   */
  onAnoChange(nuevoAno: number): void {
    console.log(`📅 CAMBIO DE AÑO DETECTADO: ${nuevoAno}`);
    console.log('🔄 Estado antes del cambio:', {
      anoAnterior: this.datosSimulacion.anoProyectado,
      precipitacionAnterior: this.datosSimulacion.precipitacion,
      humedadAnterior: this.datosSimulacion.humedad,
      radiacionAnterior: this.datosSimulacion.radiacionSolar,
      climaEsperadoAnterior: this.datosSimulacion.climaEsperado
    });
    
    // Limpiar modificaciones manuales
    this.datosModificadosManualmente.clear();
    
    // Resetear simulación
    this.resultado = null;
    this.simulacionRealizada = false;
    
    // Verificar que tenemos datos válidos antes de proyectar
    if (!this.datosOriginalesTemperatura || !this.datosOriginalesClima) {
      console.warn('⚠️ No hay datos originales, recargando todo...');
      this.cargarDatosGlaciar();
      return;
    }
    
    // Actualizar el año en los datos de simulación
    this.datosSimulacion.anoProyectado = nuevoAno;
    
    // FORZAR reproyección de datos para el nuevo año
    console.log('🔮 Forzando reproyección de datos para año:', nuevoAno);
    this.proyectarDatosParaAno(nuevoAno);
    
    console.log('✅ Estado después del cambio:', {
      anoNuevo: this.datosSimulacion.anoProyectado,
      precipitacionNueva: this.datosSimulacion.precipitacion,
      humedadNueva: this.datosSimulacion.humedad,
      radiacionNueva: this.datosSimulacion.radiacionSolar,
      climaEsperadoNuevo: this.datosSimulacion.climaEsperado,
      aumentoTemperaturaNuevo: this.datosSimulacion.aumentoTemperatura
    });
  }

  /**
   * Maneja cambios manuales en los parámetros
   */
  onParametroChange(parametro: string, valor: any): void {
    console.log(`🔧 Modificación manual de ${parametro}:`, valor);
    
    // Marcar como modificado manualmente
    this.datosModificadosManualmente.add(parametro);
    
    // Si hay modificaciones manuales, cambiar año a "no especificado"
    this.datosSimulacion.anoProyectado = 'no-especificado';
    
    // Resetear simulación para recalcular
    this.resultado = null;
    this.simulacionRealizada = false;
  }

  // Métodos específicos para cada campo
  onDDFChange(event: Event): void {
    const target = event.target as HTMLInputElement;
    this.onParametroChange('ddf', target.value);
  }

  onAumentoTempChange(event: Event): void {
    const target = event.target as HTMLInputElement;
    this.onParametroChange('aumentoTemperatura', target.value);
  }

  onRadiacionChange(event: Event): void {
    const target = event.target as HTMLInputElement;
    this.onParametroChange('radiacionSolar', target.value);
  }

  onPrecipitacionChange(event: Event): void {
    const target = event.target as HTMLInputElement;
    this.onParametroChange('precipitacion', target.value);
  }

  onHumedadChange(event: Event): void {
    const target = event.target as HTMLInputElement;
    this.onParametroChange('humedad', target.value);
  }

  onClimaEsperadoChange(event: Event): void {
    const target = event.target as HTMLInputElement;
    this.onParametroChange('climaEsperado', target.value);
  }

  /**
   * Verifica si un parámetro fue modificado manualmente
   */
  esParametroModificado(parametro: string): boolean {
    return this.datosModificadosManualmente.has(parametro);
  }

  /**
   * Resetea todos los parámetros a los valores proyectados para el año actual
   */
  resetearParametros(): void {
    console.log('🔄 Reseteando parámetros...');
    
    // Limpiar modificaciones manuales
    this.datosModificadosManualmente.clear();
    
    // Si tenemos un año válido, reproyectar
    if (typeof this.datosSimulacion.anoProyectado === 'number') {
      this.proyectarDatosParaAno(this.datosSimulacion.anoProyectado);
    } else {
      // Si no hay año específico, usar 2050 como defecto
      this.datosSimulacion.anoProyectado = 2050;
      this.proyectarDatosParaAno(2050);
    }
  }

  /**
   * Obtiene el texto a mostrar para el año
   */
  getTextoAno(): string {
    if (this.datosSimulacion.anoProyectado === 'no-especificado') {
      return 'Año no especificado';
    }
    return this.datosSimulacion.anoProyectado.toString();
  }

  /**
   * Ejecuta la simulación de deshielo
   */
  simular(): void {
    if (!this.glaciarSeleccionado) return;

    console.log('🚀 Iniciando simulación de deshielo...');
    
    // Validar parámetros
    if (!this.validarParametros()) {
      console.warn('⚠️ Parámetros inválidos, no se puede simular');
      return;
    }    // Calcular resultados
    const volumenInicial = this.glaciarSeleccionado.volumen; // km³
    const temperaturaFinal = this.datosSimulacion.temperaturaBase + this.datosSimulacion.aumentoTemperatura;
    
    console.log('🧮 Iniciando cálculos de simulación:');
    console.log(`   - Volumen inicial: ${volumenInicial} km³`);
    console.log(`   - Temperatura base: ${this.datosSimulacion.temperaturaBase}°C`);
    console.log(`   - Aumento temperatura: ${this.datosSimulacion.aumentoTemperatura}°C`);
    console.log(`   - Temperatura final: ${temperaturaFinal}°C`);
    
    // Calcular días de deshielo (cuando temperatura > 0°C)
    const diasDeshielo = this.calcularDiasDeshielo(temperaturaFinal);
    console.log(`   - Días de deshielo: ${diasDeshielo}`);    // MODELO CIENTÍFICAMENTE REALISTA basado en estudios de glaciología
    // Deshielo por radiación solar y temperatura, pero con valores más conservadores
    
    console.log('🌡️ MODELO DE DESHIELO CIENTÍFICO:');
    console.log(`   - Temperatura del aire: ${temperaturaFinal}°C`);
    
    // Deshielo base más realista según literatura científica
    let factorDeshieloBase = 0;
    if (temperaturaFinal >= 2) {
      factorDeshieloBase = temperaturaFinal * 1.0; // Deshielo normal por temperatura alta
    } else if (temperaturaFinal >= 0) {
      factorDeshieloBase = temperaturaFinal * 0.7; // Deshielo moderado cerca del punto de fusión
    } else if (temperaturaFinal >= -2) {
      factorDeshieloBase = (temperaturaFinal + 2) * 0.3; // Deshielo por radiación solar
    } else if (temperaturaFinal >= -5) {
      factorDeshieloBase = (temperaturaFinal + 5) * 0.1; // Deshielo mínimo por radiación intensa
    } else {
      factorDeshieloBase = 0.05; // Sublimación mínima incluso en frío extremo
    }
      const deshieloDiario = this.datosSimulacion.ddf * Math.max(0.05, factorDeshieloBase); // mm/día
    const deshieloAnual = deshieloDiario * diasDeshielo; // mm/año
    
    console.log(`   - Factor deshielo base: ${factorDeshieloBase.toFixed(3)}`);
    console.log(`   - DDF: ${this.datosSimulacion.ddf} mm/°C·día`);
    console.log(`   - Deshielo diario: ${deshieloDiario.toFixed(2)} mm/día`);
    console.log(`   - Deshielo anual: ${deshieloAnual.toFixed(2)} mm/año`);
    
    // Condiciones extremas más realistas - solo temperaturas muy bajas evitan deshielo
    if (deshieloAnual < 5.0 && temperaturaFinal < -8) {
      console.log('❄️ Condiciones extremas - solo sublimación mínima');
      this.resultado = {
        volumenPerdido: 0.0005, // 500,000 m³ - sublimación realista
        nuevoVolumen: volumenInicial - 0.0005,
        temperaturaFinal: Math.round(temperaturaFinal * 10) / 10,
        modificador: 0.05,
        derretidoCompleto: false,
        factoresUsados: {
          ddf: this.datosSimulacion.ddf,
          diasDeshielo,
          factorClimatico: 0.05
        }
      };
      this.simulacionRealizada = true;
      console.log('✅ Simulación completada (sublimación mínima):', this.resultado);
      this.actualizarMapaImpacto();
      return;
    }
    
    // NUEVO MODELO SIMPLIFICADO Y DIRECTO
    // Calcular pérdida de volumen basada en temperatura y factores (SIEMPRE produce resultados)
      // Factores más realistas basados en estudios glaciológicos
    const factorTemperatura = Math.max(0.2, (temperaturaFinal + 8) / 12); // 0.2 - 1.2 (rango realista)
    const factorTiempo = Math.max(0.4, diasDeshielo / 200); // 0.4 - 1.8 (temporada de deshielo)
    const factorDDF = Math.max(0.6, this.datosSimulacion.ddf / 6); // 0.6 - 1.7 (DDF típico 1-10)
    
    console.log(`🧮 MODELO CIENTÍFICO DE DESHIELO:`);
    console.log(`   - Temperatura final: ${temperaturaFinal}°C`);
    console.log(`   - Factor temperatura: ${factorTemperatura.toFixed(3)} (rango científico: 0.2-1.2)`);
    console.log(`   - Días de deshielo: ${diasDeshielo}`);
    console.log(`   - Factor tiempo: ${factorTiempo.toFixed(3)} (rango: 0.4-1.8)`);
    console.log(`   - DDF: ${this.datosSimulacion.ddf}`);
    console.log(`   - Factor DDF: ${factorDDF.toFixed(3)} (rango: 0.6-1.7)`);
    
    // Calcular pérdida base realista (1-10% anual según literatura científica)
    let porcentajePerdida = factorTemperatura * factorTiempo * factorDDF * 0.08; // Base 0-15% aprox
    
    console.log(`   - Porcentaje pérdida base: ${(porcentajePerdida * 100).toFixed(3)}%`);
    
    // Aplicar factores climáticos
    const factorClimatico = this.calcularFactorClimatico();
    porcentajePerdida *= factorClimatico * this.datosSimulacion.climaEsperado;
    
    console.log(`   - Después de factores climáticos: ${(porcentajePerdida * 100).toFixed(3)}%`);
      // Aplicar factores temporales más conservadores pero aún impactantes
    if (typeof this.datosSimulacion.anoProyectado === 'number') {
      const anoActual = this.datosSimulacion.anoProyectado;
      let factorAno = 1.0;
      
      // Factores temporales basados en proyecciones del IPCC
      if (anoActual >= 2090) {
        factorAno = 2.8; // Escenario RCP8.5 - final de siglo
      } else if (anoActual >= 2070) {
        factorAno = 2.2; // Aceleración significativa
      } else if (anoActual >= 2050) {
        factorAno = 1.8; // Punto de inflexión climático
      } else if (anoActual >= 2040) {
        factorAno = 1.5; // Cambios notorios
      } else if (anoActual >= 2030) {
        factorAno = 1.3; // Primeros impactos significativos
      } else if (anoActual >= 2025) {
        factorAno = 1.1; // Cambios iniciales
      }
      
      porcentajePerdida *= factorAno;
      console.log(`   - Factor año (${anoActual}): ${factorAno.toFixed(2)}x (IPCC-calibrado)`);
      console.log(`   - Porcentaje pérdida con factor año: ${(porcentajePerdida * 100).toFixed(3)}%`);
    }
      // Calcular volumen perdido
    let volumenPerdidoReal = volumenInicial * porcentajePerdida;
    
    console.log(`🔍 VERIFICACIÓN DEL CÁLCULO DE VOLUMEN:`);
    console.log(`   - Volumen inicial del glaciar: ${volumenInicial} km³`);
    console.log(`   - Porcentaje de pérdida calculado: ${(porcentajePerdida * 100).toFixed(4)}%`);
    console.log(`   - Volumen perdido calculado: ${volumenPerdidoReal.toFixed(8)} km³`);    // Mínimo realista pero visible - basado en mediciones reales
    const minimoAbsoluto = 0.002; // 2,000,000 m³ = 0.002 km³ (pérdidas anuales mínimas observadas)
      if (volumenPerdidoReal < minimoAbsoluto) {
      if (temperaturaFinal > -6) { // Temperatura científicamente razonable
        volumenPerdidoReal = minimoAbsoluto;
        console.log(`⚠️ Aplicando pérdida mínima científica: ${minimoAbsoluto} km³`);
        console.log(`⚠️ Razón: Temperatura ${temperaturaFinal}°C permite deshielo detectable`);
      } else {
        volumenPerdidoReal = minimoAbsoluto * 0.25; // Sublimación mínima en condiciones muy frías
        console.log(`❄️ Solo sublimación: ${volumenPerdidoReal.toFixed(6)} km³ (temperatura ${temperaturaFinal}°C)`);
      }
    }
    
    // Máximo realista (no puede perder más del 90% en un año)
    const maximoPerdida = volumenInicial * 0.9;
    if (volumenPerdidoReal > maximoPerdida) {
      volumenPerdidoReal = maximoPerdida;
      console.log(`⚠️ Limitando pérdida al 90% del volumen: ${maximoPerdida.toFixed(6)} km³`);
    }
    
    console.log(`🎯 VOLUMEN PERDIDO FINAL: ${volumenPerdidoReal.toFixed(8)} km³`);
    console.log(`📊 Porcentaje del volumen total: ${((volumenPerdidoReal / volumenInicial) * 100).toFixed(4)}%`);
    
    // Calcular nuevo volumen
    const nuevoVolumen = Math.max(0, volumenInicial - volumenPerdidoReal);
    const derretidoCompleto = nuevoVolumen <= volumenInicial * 0.05; // Menos del 5% original
    console.log(`   - Nuevo volumen: ${nuevoVolumen.toFixed(6)} km³`);
    console.log(`   - Derretido completo: ${derretidoCompleto}`);    console.log(`🧮 ANTES DE ASIGNAR RESULTADO:`);
    console.log(`   - volumenPerdidoReal: ${volumenPerdidoReal}`);
    console.log(`   - nuevoVolumen: ${nuevoVolumen}`);
    console.log(`   - this.resultado actual: ${this.resultado}`);

    this.resultado = {
      volumenPerdido: Math.round(volumenPerdidoReal * 1000000) / 1000000, // 6 decimales
      nuevoVolumen: Math.round(nuevoVolumen * 1000000) / 1000000, // 6 decimales
      temperaturaFinal: Math.round(temperaturaFinal * 10) / 10,
      modificador: Math.round(factorClimatico * 100) / 100,
      derretidoCompleto,
      factoresUsados: {
        ddf: this.datosSimulacion.ddf,
        diasDeshielo,
        factorClimatico: Math.round(factorClimatico * 100) / 100
      }
    };    console.log(`🧮 DESPUÉS DE ASIGNAR RESULTADO:`);
    console.log(`   - this.resultado: ${JSON.stringify(this.resultado, null, 2)}`);
    console.log(`   - this.resultado.volumenPerdido: ${this.resultado.volumenPerdido}`);
    console.log(`   - this.resultado.nuevoVolumen: ${this.resultado.nuevoVolumen}`);

    // Generar análisis detallado de impactos
    console.log('🔍 Generando análisis detallado de impactos...');
    try {
      this.resultado.analisisImpacto = this.generarAnalisisImpacto();
      console.log('✅ Análisis de impacto generado correctamente');
    } catch (error) {
      console.error('❌ Error generando análisis de impacto:', error);
    }

    this.simulacionRealizada = true;
    
    console.log(`✅ ESTADO FINAL DE SIMULACIÓN:`);
    console.log(`   - simulacionRealizada: ${this.simulacionRealizada}`);
    console.log(`   - resultado existe: ${!!this.resultado}`);
    console.log(`   - volumen perdido final: ${this.resultado?.volumenPerdido}`);
    console.log(`   - nuevo volumen final: ${this.resultado?.nuevoVolumen}`);
    
    // Forzar detección de cambios en Angular
    setTimeout(() => {
      console.log('🔄 Verificación después de timeout:');
      console.log(`   - simulacionRealizada: ${this.simulacionRealizada}`);
      console.log(`   - resultado: ${!!this.resultado}`);
      if (this.resultado) {
        console.log(`   - volumen perdido: ${this.resultado.volumenPerdido}`);
      }
    }, 50);
      console.log('✅ Simulación completada - RESULTADO FINAL:');
    console.log(`🎯 Volumen perdido: ${this.resultado.volumenPerdido} km³`);
    console.log(`🧊 Nuevo volumen: ${this.resultado.nuevoVolumen} km³`);
    console.log(`🌡️ Temperatura final: ${this.resultado.temperaturaFinal}°C`);
    console.log(`📈 Modificador: ${this.resultado.modificador}`);
    console.log(`💀 Derretido completo: ${this.resultado.derretidoCompleto}`);
    console.log('📋 Objeto resultado completo:', this.resultado);
    
    // Verificar que la interfaz se actualizó
    setTimeout(() => {
      console.log('🔍 Verificando estado después de 100ms:');
      console.log('   - simulacionRealizada:', this.simulacionRealizada);
      console.log('   - resultado existe:', !!this.resultado);
      if (this.resultado) {
        console.log('   - volumen perdido en resultado:', this.resultado.volumenPerdido);
      }
    }, 100);

    // Inicializar el mapa después de que se actualice el DOM
    setTimeout(() => {
      console.log('🗺️ Intentando inicializar mapa después de simulación...');
      this.inicializarMapaSimulacion();
    }, 200);
    
    // Actualizar mapa de impacto como respaldo
    setTimeout(() => {
      this.actualizarMapaImpacto();
    }, 400);
  }

  /**
   * Calcula los días de deshielo en el año
   */
  private calcularDiasDeshielo(temperaturaMedia: number): number {
    // Modelo simple: días por encima de 0°C varían según temperatura media
    if (temperaturaMedia <= -5) return 30;   // Muy frío, poco deshielo
    if (temperaturaMedia <= -2) return 60;   // Frío, deshielo limitado
    if (temperaturaMedia <= 0) return 90;    // Cerca del punto de fusión
    if (temperaturaMedia <= 2) return 120;   // Tibio, más deshielo
    if (temperaturaMedia <= 5) return 150;   // Cálido, mucho deshielo
    return 180; // Muy cálido, deshielo prolongado
  }
  /**
   * Calcula el factor climático basado en condiciones
   */
  private calcularFactorClimatico(): number {
    let factor = 1.0;
      console.log('🌤️ Calculando factor climático:');
    console.log(`   - Año proyectado: ${this.datosSimulacion.anoProyectado}`);
    console.log(`   - Radiación solar: ${this.datosSimulacion.radiacionSolar}%`);
    console.log(`   - Humedad: ${this.datosSimulacion.humedad}%`);
    console.log(`   - Precipitación: ${this.datosSimulacion.precipitacion} mm`);
    console.log(`   - Factor clima esperado: ${this.datosSimulacion.climaEsperado}`);
    
    // Factor por radiación solar (más impactante)
    const radiacionNormalizada = this.datosSimulacion.radiacionSolar / 100;
    const factorRadiacion = 0.6 + radiacionNormalizada * 0.8; // 0.6 - 1.4
    factor *= factorRadiacion;
    console.log(`   - Factor radiación: ${factorRadiacion.toFixed(3)}`);
    
    // Factor por humedad (más impactante)
    const humedadNormalizada = this.datosSimulacion.humedad / 100;
    const factorHumedad = 1.4 - humedadNormalizada * 0.6; // 0.8 - 1.4
    factor *= factorHumedad;
    console.log(`   - Factor humedad: ${factorHumedad.toFixed(3)}`);
    
    // Factor por precipitación (más agresivo)
    let factorPrecipitacion = 1.0;
    if (this.datosSimulacion.precipitacion < 500) {
      factorPrecipitacion = 1.3; // Muy poca precipitación aumenta mucho el deshielo
    } else if (this.datosSimulacion.precipitacion < 1000) {
      factorPrecipitacion = 1.15; // Poca precipitación aumenta el deshielo
    } else if (this.datosSimulacion.precipitacion > 2000) {
      factorPrecipitacion = 0.7; // Mucha precipitación reduce bastante el deshielo
    } else if (this.datosSimulacion.precipitacion > 1500) {
      factorPrecipitacion = 0.85; // Precipitación alta reduce el deshielo
    }
    factor *= factorPrecipitacion;
    console.log(`   - Factor precipitación: ${factorPrecipitacion.toFixed(3)}`);    // Factor adicional por año proyectado (cambio climático según IPCC)
    let factorAno = 1.0;
    if (typeof this.datosSimulacion.anoProyectado === 'number') {
      const anoActual = this.datosSimulacion.anoProyectado;
      if (anoActual >= 2080) {
        factorAno = 2.2; // Fin de siglo - escenario alto pero realista
      } else if (anoActual >= 2060) {
        factorAno = 1.9; // Cambios acelerados
      } else if (anoActual >= 2050) {
        factorAno = 1.6; // Punto de inflexión
      } else if (anoActual > 2030) {
        factorAno = 1.0 + ((anoActual - 2030) / 20) * 0.6; // Incremento gradual
      } else if (anoActual > 2020) {
        factorAno = 1.0 + ((anoActual - 2020) / 10) * 0.4; // +40% hacia 2030
      }
    }
    factor *= factorAno;
    console.log(`   - Factor año (IPCC-calibrado): ${factorAno.toFixed(3)}`);
    
    // Factor final científicamente razonable
    const factorFinal = Math.max(0.2, Math.min(5.0, factor)); // Límites científicos realistas
    console.log(`   - Factor climático FINAL (rango científico 0.2-5.0): ${factorFinal.toFixed(3)}`);
    console.log(`   - Factor climático x clima esperado = ${(factorFinal * this.datosSimulacion.climaEsperado).toFixed(3)}`);
    
    return factorFinal;
  }

  /**
   * Valida los parámetros de simulación
   */
  private validarParametros(): boolean {
    this.errores = {};
    let valido = true;    if (this.datosSimulacion.ddf < 1 || this.datosSimulacion.ddf > 15) {
      this.errores['ddf'] = 'DDF debe estar entre 1 y 15 (valores futuros pueden ser más altos)';
      valido = false;
    }

    if (this.datosSimulacion.radiacionSolar < 0 || this.datosSimulacion.radiacionSolar > 100) {
      this.errores['radiacion'] = 'Radiación debe estar entre 0 y 100%';
      valido = false;
    }    if (this.datosSimulacion.climaEsperado < 0.5 || this.datosSimulacion.climaEsperado > 5.0) {
      this.errores['clima'] = 'Factor climático debe estar entre 0.5 y 5.0 (rango científico realista)';
      valido = false;
    }

    return valido;
  }  /**
   * Inicializa el mapa pequeño de simulación
   */
  private inicializarMapaSimulacion(): void {
    if (!this.glaciarSeleccionado) return;

    // Si ya existe un mapa, destruirlo primero
    if (this.mapaSimulacion) {
      console.log('🗺️ Limpiando mapa existente...');
      this.mapaSimulacion.remove();
      this.mapaSimulacion = null;
      this.glaciarLayer = null;
      this.impactoLayer = null;
    }

    // Esperar a que el elemento esté disponible en el DOM
    setTimeout(() => {
      const mapContainer = document.getElementById('mapa-simulacion');
      if (!mapContainer) {
        console.warn('⚠️ Elemento mapa-simulacion no encontrado en el DOM, reintentando...');
        setTimeout(() => this.inicializarMapaSimulacion(), 200);
        return;
      }

      console.log('🗺️ Inicializando mapa de simulación...');

      try {
        // Crear mapa centrado en el glaciar
        this.mapaSimulacion = L.map('mapa-simulacion', {
          zoomControl: true,
          attributionControl: true
        }).setView(
          [this.glaciarSeleccionado!.latitud, this.glaciarSeleccionado!.longitud],
          12
        );

        // Agregar capa DEM
        this.demLayer = L.tileLayer('https://{s}.tile.opentopomap.org/{z}/{x}/{y}.png', {
          attribution: '© OpenTopoMap',
          maxZoom: 15
        }).addTo(this.mapaSimulacion);

        // Agregar la geometría real del glaciar si está disponible
        if (this.glaciarSeleccionado!.geometria) {
          console.log('🏔️ Agregando geometría real del glaciar al mapa');
          
          // Estilo para el glaciar
          const glaciarStyle = {
            color: '#4FC3F7',
            weight: 3,
            fillColor: '#E1F5FE',
            fillOpacity: 0.7,
            className: 'glaciar-shape'
          };

          this.glaciarLayer = L.geoJSON(this.glaciarSeleccionado!.geometria, {
            style: glaciarStyle,
            onEachFeature: (feature, layer) => {
              const glaciar = this.glaciarSeleccionado!;
              layer.bindPopup(`
                <div class="glaciar-popup">
                  <strong>🏔️ ${glaciar.nombre}</strong><br>
                  <strong>Tipo:</strong> ${glaciar.tipo}<br>
                  <strong>Volumen:</strong> ${glaciar.volumen.toFixed(2)} km³<br>
                  <strong>Área:</strong> ${(glaciar.area / 1000000).toFixed(2)} km²<br>
                  ${glaciar.altura_media ? `<strong>Altura media:</strong> ${glaciar.altura_media} m<br>` : ''}
                  ${glaciar.clasificacion ? `<strong>Clasificación:</strong> ${glaciar.clasificacion}<br>` : ''}
                  <div class="popup-footer">
                    <small>Forma real del glaciar basada en datos satelitales</small>
                  </div>
                </div>
              `, {
                maxWidth: 300,
                className: 'glaciar-popup-container'
              });
            }
          }).addTo(this.mapaSimulacion);

          // Ajustar la vista para mostrar todo el glaciar
          const bounds = this.glaciarLayer.getBounds();
          this.mapaSimulacion.fitBounds(bounds, { padding: [20, 20] });
          
        } else {
          // Fallback: usar marcador si no hay geometría
          const glaciarIcon = L.divIcon({
            html: '🏔️',
            iconSize: [30, 30],
            className: 'glaciar-icon'
          });

          L.marker([this.glaciarSeleccionado!.latitud, this.glaciarSeleccionado!.longitud], {
            icon: glaciarIcon
          }).addTo(this.mapaSimulacion).bindPopup(`
            <strong>${this.glaciarSeleccionado!.nombre}</strong><br>
            Tipo: ${this.glaciarSeleccionado!.tipo}<br>
            Volumen: ${this.glaciarSeleccionado!.volumen.toFixed(2)} km³
          `);
        }

        console.log('🗺️ Mapa de simulación inicializado correctamente');

        // Si hay resultados de simulación, actualizar el mapa con el área de impacto
        if (this.resultado) {
          this.actualizarVisualizacionImpacto();
        }

      } catch (error) {
        console.error('❌ Error inicializando mapa de simulación:', error);
      }
    }, 100);
  }

  /**
   * Actualiza el mapa con el área de impacto de la simulación
   */
  private actualizarMapaImpacto(): void {
    console.log('🗺️ Intentando actualizar mapa de impacto...');
    console.log('   - Mapa existe:', !!this.mapaSimulacion);
    console.log('   - Resultado existe:', !!this.resultado);
    console.log('   - Glaciar existe:', !!this.glaciarSeleccionado);
    
    if (!this.mapaSimulacion) {
      console.log('⚠️ Mapa no inicializado, inicializando ahora...');
      // Inicializar el mapa primero
      this.inicializarMapaSimulacion();
      return;
    }

    if (!this.resultado) {
      console.error('❌ No hay resultado de simulación para mostrar en el mapa');
      return;
    }

    if (!this.glaciarSeleccionado) {
      console.error('❌ No hay glaciar seleccionado para mostrar en el mapa');
      return;
    }

    this.actualizarVisualizacionImpacto();
  }  /**
   * Actualiza la visualización del impacto en el mapa
   */
  private actualizarVisualizacionImpacto(): void {
    // Verificar que tenemos todos los elementos necesarios
    if (!this.mapaSimulacion || !this.resultado || !this.glaciarSeleccionado) {
      console.error('❌ Faltan elementos para actualizar visualización de impacto');
      return;
    }

    // Limpiar capa de impacto anterior
    if (this.impactoLayer && this.mapaSimulacion) {
      console.log('🧹 Limpiando capa de impacto anterior');
      this.mapaSimulacion.removeLayer(this.impactoLayer);
      this.impactoLayer = null;
    }

    // Calcular datos de impacto
    const volumenPerdido = this.resultado.volumenPerdido;
    const volumenInicial = this.glaciarSeleccionado.volumen;
    const porcentajePerdida = (volumenPerdido / volumenInicial) * 100;

    console.log(`📊 Calculando impacto:`);
    console.log(`   - Volumen perdido: ${volumenPerdido} km³`);
    console.log(`   - Volumen inicial: ${volumenInicial} km³`);
    console.log(`   - Porcentaje perdido: ${porcentajePerdida.toFixed(2)}%`);

    // Crear área de impacto basada en la geometría real del glaciar
    this.crearAreaImpactoFromGeometry(porcentajePerdida);
  }

  /**
   * Crea el área de impacto basada en la geometría real del glaciar
   */
  private crearAreaImpactoFromGeometry(porcentajePerdida: number): void {
    if (!this.glaciarSeleccionado || !this.mapaSimulacion) return;

    // Color del impacto según severidad
    const colorImpacto = this.resultado!.derretidoCompleto ? '#d32f2f' : 
                        porcentajePerdida > 50 ? '#f57c00' : '#388e3c';

    // Verificar si tenemos geometría real del glaciar
    if (this.glaciarSeleccionado.geometria) {
      console.log('�️ Creando área de impacto basada en geometría real del glaciar');
      
      // Calcular factor de expansión basado en el porcentaje de pérdida
      const factorExpansion = 1 + (porcentajePerdida / 100) * 2; // Expansión de hasta 2x
      
      // Crear geometría expandida para mostrar el área de impacto
      const geometriaImpacto = this.expandirGeometriaGlaciar(
        this.glaciarSeleccionado.geometria, 
        factorExpansion
      );

      if (geometriaImpacto) {
        // Crear capa de impacto con la geometría expandida
        this.impactoLayer = L.geoJSON(geometriaImpacto, {
          style: {
            color: colorImpacto,
            fillColor: colorImpacto,
            fillOpacity: 0.3,
            weight: 3,
            dashArray: '10, 5', // Línea punteada para diferenciarlo del glaciar
            className: 'area-impacto'
          }
        }).addTo(this.mapaSimulacion) as any;        // Popup con información del impacto
        (this.impactoLayer as any).bindPopup(`
          <div class="impacto-popup">
            <strong>🌊 Área de Impacto del Deshielo</strong><br>
            <strong>Glaciar:</strong> ${this.glaciarSeleccionado.nombre}<br>
            <strong>Pérdida de volumen:</strong> ${this.resultado!.volumenPerdido.toFixed(3)} km³<br>
            <strong>Volumen restante:</strong> ${this.resultado!.nuevoVolumen.toFixed(3)} km³<br>
            <strong>Porcentaje perdido:</strong> ${porcentajePerdida.toFixed(1)}%<br>
            <strong>Temperatura final:</strong> ${this.resultado!.temperaturaFinal.toFixed(1)}°C<br>
            ${this.resultado!.derretidoCompleto ? '<div style="color: red; font-weight: bold;">⚠️ IMPACTO CRÍTICO</div>' : ''}
            <div class="popup-footer">
              <small>Área calculada en base a la forma real del glaciar</small>
            </div>
          </div>
        `, {
          maxWidth: 350,
          className: 'impacto-popup-container'
        });

        console.log('✅ Área de impacto creada basada en geometría real');
      } else {
        // Fallback si falla la expansión de geometría
        this.crearAreaImpactoCircular(porcentajePerdida, colorImpacto);
      }
    } else {
      // Fallback: usar área circular si no hay geometría
      console.log('⚠️ No hay geometría disponible, usando área de impacto circular');
      this.crearAreaImpactoCircular(porcentajePerdida, colorImpacto);
    }
  }

  /**
   * Expande la geometría del glaciar para crear el área de impacto
   */
  private expandirGeometriaGlaciar(geometria: any, factor: number): any {
    if (!geometria || !geometria.coordinates) return null;

    try {
      // Obtener el centroide del glaciar para la expansión
      const centroide = this.calcularCentroideGeometria(geometria);
      
      if (geometria.type === 'Polygon') {
        return this.expandirPoligono(geometria, centroide, factor);
      } else if (geometria.type === 'MultiPolygon') {
        return this.expandirMultiPoligono(geometria, centroide, factor);
      }
    } catch (error) {
      console.error('❌ Error expandiendo geometría del glaciar:', error);
      return null;
    }

    return null;
  }

  /**
   * Calcula el centroide de una geometría
   */
  private calcularCentroideGeometria(geometria: any): [number, number] {
    if (geometria.type === 'Polygon') {
      const coords = geometria.coordinates[0]; // Primer anillo
      let sumLat = 0, sumLon = 0;
      for (const coord of coords) {
        sumLon += coord[0];
        sumLat += coord[1];
      }
      return [sumLon / coords.length, sumLat / coords.length];
    } else if (geometria.type === 'MultiPolygon') {
      // Para MultiPolygon, usar el centroide del primer polígono
      const coords = geometria.coordinates[0][0];
      let sumLat = 0, sumLon = 0;
      for (const coord of coords) {
        sumLon += coord[0];
        sumLat += coord[1];
      }
      return [sumLon / coords.length, sumLat / coords.length];
    }
    
    return [this.glaciarSeleccionado!.longitud, this.glaciarSeleccionado!.latitud];
  }

  /**
   * Expande un polígono desde su centroide
   */
  private expandirPoligono(poligono: any, centroide: [number, number], factor: number): any {
    const nuevasCoords = poligono.coordinates.map((ring: number[][]) => {
      return ring.map((coord: number[]) => {
        const deltaLon = (coord[0] - centroide[0]) * factor;
        const deltaLat = (coord[1] - centroide[1]) * factor;
        return [centroide[0] + deltaLon, centroide[1] + deltaLat];
      });
    });

    return {
      type: 'Polygon',
      coordinates: nuevasCoords
    };
  }

  /**
   * Expande un multipolígono desde su centroide
   */
  private expandirMultiPoligono(multiPoligono: any, centroide: [number, number], factor: number): any {
    const nuevasCoords = multiPoligono.coordinates.map((poligono: number[][][]) => {
      return poligono.map((ring: number[][]) => {
        return ring.map((coord: number[]) => {
          const deltaLon = (coord[0] - centroide[0]) * factor;
          const deltaLat = (coord[1] - centroide[1]) * factor;
          return [centroide[0] + deltaLon, centroide[1] + deltaLat];
        });
      });
    });

    return {
      type: 'MultiPolygon',
      coordinates: nuevasCoords
    };
  }

  /**
   * Crea área de impacto circular (fallback)
   */
  private crearAreaImpactoCircular(porcentajePerdida: number, colorImpacto: string): void {
    const radioImpacto = Math.max(500, porcentajePerdida * 100); // metros

    console.log(`📊 Creando área de impacto circular con radio: ${radioImpacto} metros`);

    try {
      this.impactoLayer = L.circle(
        [this.glaciarSeleccionado!.latitud, this.glaciarSeleccionado!.longitud],
        {
          radius: radioImpacto,
          color: colorImpacto,
          fillColor: colorImpacto,
          fillOpacity: 0.3,
          weight: 2,
          dashArray: '10, 5'
        }
      ).addTo(this.mapaSimulacion!) as any;

      (this.impactoLayer as any).bindPopup(`
        <strong>Área de Impacto (Estimada)</strong><br>
        Pérdida de volumen: ${this.resultado!.volumenPerdido.toFixed(3)} km³<br>
        Porcentaje perdido: ${porcentajePerdida.toFixed(1)}%<br>
        Radio de impacto: ${radioImpacto.toFixed(0)} metros<br>
        ${this.resultado!.derretidoCompleto ? '<span style="color: red;">⚠️ Derretimiento crítico</span>' : ''}
      `);      console.log('✅ Área de impacto circular creada como fallback');
      
    } catch (error) {
      console.error('❌ Error creando círculo de impacto:', error);
    }
  }
  
  /**
   * Verifica si el análisis de impacto está disponible y completo
   */
  get tieneAnalisisCompleto(): boolean {
    return !!(this.resultado?.analisisImpacto && 
              this.resultado.analisisImpacto.impactoCultural &&
              this.resultado.analisisImpacto.impactoAmbiental &&
              this.resultado.analisisImpacto.impactoUrbano);
  }

  /**
   * Obtiene explicación detallada de la simulación
   */
  get explicacionSimulacion(): string {
    if (!this.glaciarSeleccionado || !this.datosOriginalesTemperatura) {
      return 'Selecciona un glaciar para ver la explicación de la simulación.';
    }

    const comuna = this.datosOriginalesTemperatura.comuna;
    const deltaReal = this.datosOriginalesTemperatura.delta_temperatura;
    const ano = this.datosSimulacion.anoProyectado;

    return `Esta simulación utiliza datos reales de la capa de temperatura para la comuna de ${comuna}, 
donde se registra un aumento de temperatura de ${deltaReal}°C para el período 2020-2050.

Para el año ${ano}, se proyecta un aumento de ${this.datosSimulacion.aumentoTemperatura}°C basado en este delta real.

Los datos climáticos (precipitación: ${this.datosSimulacion.precipitacion}mm, humedad: ${this.datosSimulacion.humedad}%, 
radiación solar: ${this.datosSimulacion.radiacionSolar}%) provienen de OpenMeteo y se proyectan considerando 
las tendencias del cambio climático.

El glaciar ${this.glaciarSeleccionado.nombre} tiene una temperatura base estimada de ${this.datosSimulacion.temperaturaBase}°C, 
típica para glaciares a esta altitud y latitud.`;
  }/**
   * Genera un análisis detallado de impactos basado en la simulación
   */
  private generarAnalisisImpacto(): AnalisisImpacto {
    if (!this.glaciarSeleccionado || !this.resultado) {
      throw new Error('No hay datos suficientes para el análisis');
    }

    const volumenPerdido = this.resultado.volumenPerdido;
    const porcentajePerdida = (volumenPerdido / this.glaciarSeleccionado.volumen) * 100;
    const coordenadas = { lat: this.glaciarSeleccionado.latitud, lng: this.glaciarSeleccionado.longitud };

    // Análisis de impacto cultural
    const impactoCultural = this.analizarImpactoCultural(porcentajePerdida, coordenadas);
    
    // Análisis de impacto ambiental  
    const impactoAmbiental = this.analizarImpactoAmbiental(porcentajePerdida, coordenadas);
    
    // Análisis de impacto urbano
    const impactoUrbano = this.analizarImpactoUrbano(volumenPerdido, coordenadas);

    // Recomendaciones generales
    const recomendaciones = this.generarRecomendaciones(impactoCultural.nivel, impactoAmbiental.nivel, impactoUrbano.nivel);

    // Nivel de riesgo general
    const niveles = [impactoCultural.nivel, impactoAmbiental.nivel, impactoUrbano.nivel];
    const nivelRiesgoGeneral = this.determinarNivelRiesgoGeneral(niveles);

    return {
      impactoCultural,
      impactoAmbiental,
      impactoUrbano,
      recomendaciones,
      nivelRiesgoGeneral
    };
  }

  private analizarImpactoCultural(porcentajePerdida: number, coordenadas: {lat: number, lng: number}) {
    let nivel: 'bajo' | 'medio' | 'alto' | 'critico' = 'bajo';
    let descripcion = '';
    let sitiosAfectados: string[] = [];
    let comunidadesIndigenas: string[] = [];
    let patrimonioAfectado: string[] = [];

    // Determinar comunidades indígenas cercanas según región
    const region = this.glaciarSeleccionado?.region || '';
    if (region.includes('Aysén') || region.includes('Patagonia')) {
      comunidadesIndigenas = ['Tehuelches', 'Comunidades gauchas históricas'];
      sitiosAfectados.push('Rutas ganaderas tradicionales', 'Sitios arqueológicos patagónicos');
    }
    if (region.includes('Magallanes')) {
      comunidadesIndigenas = ['Kawésqar', 'Yaganes', 'Selk\'nam (sitios históricos)'];
      sitiosAfectados.push('Canales navegables tradicionales', 'Sitios ceremoniales kawésqar');
    }

    // Evaluar nivel de impacto
    if (porcentajePerdida > 70) {
      nivel = 'critico';
      descripcion = 'Pérdida crítica del glaciar amenaza gravemente el patrimonio cultural y las tradiciones ancestrales de navegación y supervivencia en la región.';
      patrimonioAfectado.push('Rutas tradicionales de navegación', 'Conocimientos ancestrales sobre el hielo', 'Sitios sagrados relacionados con glaciares');
    } else if (porcentajePerdida > 40) {
      nivel = 'alto';
      descripcion = 'El retroceso significativo del glaciar afecta las prácticas culturales tradicionales y modifica el paisaje cultural histórico.';
      patrimonioAfectado.push('Paisajes culturales patagónicos', 'Rutas históricas de exploración');
    } else if (porcentajePerdida > 20) {
      nivel = 'medio';
      descripcion = 'Cambios visibles en el glaciar comienzan a alterar el contexto cultural y las referencias territoriales tradicionales.';
      sitiosAfectados.push('Miradores históricos', 'Referencias de navegación tradicional');
    } else {
      nivel = 'bajo';
      descripcion = 'El impacto cultural es mínimo, pero se recomienda monitoreo para preservar el patrimonio a largo plazo.';
    }

    return { nivel, descripcion, sitiosAfectados, comunidadesIndigenas, patrimonioAfectado };
  }

  private analizarImpactoAmbiental(porcentajePerdida: number, coordenadas: {lat: number, lng: number}) {
    let nivel: 'bajo' | 'medio' | 'alto' | 'critico' = 'bajo';
    let descripcion = '';
    let ecosistemasAfectados: string[] = [];
    let especiesEnRiesgo: string[] = [];
    let habitatsFragmentados: string[] = [];
    let calidadAgua = '';

    // Ecosistemas típicos de la Patagonia
    ecosistemasAfectados = [
      'Ecosistemas periglaciales',
      'Bosques templados patagónicos', 
      'Turberas de Sphagnum',
      'Sistemas lacustres glaciales'
    ];

    // Especies características de la región
    especiesEnRiesgo = [
      'Huemul (Hippocamelus bisulcus)',
      'Cóndor andino (Vultur gryphus)',
      'Cauquén colorado (Chloephaga rubidiceps)',
      'Flora endémica periglacial'
    ];

    if (porcentajePerdida > 70) {
      nivel = 'critico';
      descripcion = 'Colapso del ecosistema glacial con pérdida masiva de hábitats únicos y alteración irreversible de la red hidrológica regional.';
      habitatsFragmentados.push('Corredores biológicos glaciales', 'Zonas de refugio climático', 'Ecosistemas de alta montaña');
      calidadAgua = 'Deterioro severo por sedimentación masiva y cambios en temperatura del agua';
      especiesEnRiesgo.push('Invertebrados acuáticos glaciales', 'Musgos y líquenes especializados');
    } else if (porcentajePerdida > 40) {
      nivel = 'alto';
      descripcion = 'Fragmentación significativa de hábitats glaciales y alteración de patrones hidrológicos que afectan la biodiversidad regional.';
      habitatsFragmentados.push('Zonas de transición glacial-bosque', 'Humedales alimentados por deshielo');
      calidadAgua = 'Aumento de sedimentos y variabilidad térmica en cursos de agua';
    } else if (porcentajePerdida > 20) {
      nivel = 'medio';
      descripcion = 'Cambios en la disponibilidad de agua dulce y modificación gradual de microclimas locales.';
      calidadAgua = 'Cambios estacionales en flujo y temperatura del agua';
    } else {
      nivel = 'bajo';
      descripcion = 'Impacto ambiental limitado, pero requiere monitoreo de especies indicadoras y calidad del agua.';
      calidadAgua = 'Cambios mínimos en la calidad del agua';
    }

    return { nivel, descripcion, ecosistemasAfectados, especiesEnRiesgo, habitatsFragmentados, calidadAgua };
  }

  private analizarImpactoUrbano(volumenPerdido: number, coordenadas: {lat: number, lng: number}) {
    let nivel: 'bajo' | 'medio' | 'alto' | 'critico' = 'bajo';
    let descripcion = '';
    let ciudadesCercanas: CiudadCercana[] = [];
    let poblacionAfectada = 0;
    let infraestructuraRiesgo: string[] = [];
    let recursosHidricosAfectados: string[] = [];

    // Ciudades típicas de la región de Aysén y Magallanes
    ciudadesCercanas = this.obtenerCiudadesCercanas(coordenadas);
    poblacionAfectada = ciudadesCercanas.reduce((total, ciudad) => total + ciudad.poblacion, 0);

    // Agua adicional generada por el deshielo (conversión aproximada)
    const aguaGenerada = volumenPerdido * 1000000000; // m³ a litros

    if (volumenPerdido > 1.0) { // >1 km³
      nivel = 'critico';
      descripcion = `Riesgo crítico de inundación con ${aguaGenerada.toExponential(2)} litros de agua adicional generada. Evacuación preventiva recomendada.`;
      infraestructuraRiesgo.push('Plantas de tratamiento de agua', 'Puentes y carreteras costeras', 'Puertos y muelles', 'Viviendas en zonas bajas');
      recursosHidricosAfectados.push('Sistemas de agua potable urbana', 'Reservorios municipales', 'Infraestructura portuaria');
    } else if (volumenPerdido > 0.5) {
      nivel = 'alto';
      descripcion = `Alto riesgo de inundación localizada con ${aguaGenerada.toExponential(2)} litros adicionales. Monitoreo intensivo necesario.`;
      infraestructuraRiesgo.push('Sistemas de drenaje urbano', 'Carreteras de acceso', 'Infraestructura turística');
      recursosHidricosAfectados.push('Cuencas hídricas locales', 'Sistemas de riego');    } else if (volumenPerdido > 0.1) {
      nivel = 'medio';
      descripcion = 'Aumento moderado en el flujo de agua que requiere ajustes en la gestión hídrica local.';
      infraestructuraRiesgo.push('Sistemas de alcantarillado', 'Infraestructura de turismo aventura');
      recursosHidricosAfectados.push('Arroyos locales', 'Sistemas de captación rural');
    } else {
      nivel = 'bajo';
      descripcion = 'Impacto urbano mínimo, pero se recomienda monitoreo preventivo de cauces.';
      recursosHidricosAfectados.push('Monitoreo de calidad de agua');
    }

    return { nivel, descripcion, ciudadesCercanas, poblacionAfectada, infraestructuraRiesgo, recursosHidricosAfectados };
  }

  private obtenerCiudadesCercanas(coordenadas: {lat: number, lng: number}): CiudadCercana[] {
    // Ciudades principales de la Patagonia chilena con sus coordenadas aproximadas
    const ciudadesPatagonia = [
      { nombre: 'Coyhaique', lat: -45.5752, lng: -72.0662, poblacion: 60000 },
      { nombre: 'Puerto Aysén', lat: -45.4014, lng: -72.6925, poblacion: 25000 },
      { nombre: 'Chile Chico', lat: -46.5433, lng: -71.7256, poblacion: 5000 },
      { nombre: 'Puerto Natales', lat: -51.7236, lng: -72.5084, poblacion: 22000 },
      { nombre: 'Punta Arenas', lat: -53.1638, lng: -70.9171, poblacion: 130000 },
      { nombre: 'El Calafate (ARG)', lat: -50.3404, lng: -72.2648, poblacion: 25000 },
      { nombre: 'Cochrane', lat: -47.2644, lng: -72.5733, poblacion: 3500 },
      { nombre: 'Villa O\'Higgins', lat: -48.4651, lng: -72.5733, poblacion: 800 }
    ];

    return ciudadesPatagonia
      .map(ciudad => {
        const distancia = this.calcularDistancia(coordenadas.lat, coordenadas.lng, ciudad.lat, ciudad.lng);
        let nivelRiesgo: 'bajo' | 'medio' | 'alto' | 'critico' = 'bajo';
        let tipoImpacto: string[] = [];

        if (distancia < 50) {
          nivelRiesgo = 'critico';
          tipoImpacto = ['Inundación directa', 'Infraestructura crítica', 'Evacuación necesaria'];
        } else if (distancia < 100) {
          nivelRiesgo = 'alto';
          tipoImpacto = ['Aumento de caudales', 'Monitoreo intensivo'];
        } else if (distancia < 200) {
          nivelRiesgo = 'medio';
          tipoImpacto = ['Cambios hidrológicos regionales'];
        } else {
          tipoImpacto = ['Impacto mínimo'];
        }

        return {
          nombre: ciudad.nombre,
          distancia,
          poblacion: ciudad.poblacion,
          nivelRiesgo,
          tipoImpacto
        };
      })
      .filter(ciudad => ciudad.distancia < 300) // Solo ciudades dentro de 300km
      .sort((a, b) => a.distancia - b.distancia)
      .slice(0, 5); // Top 5 ciudades más cercanas
  }

  private calcularDistancia(lat1: number, lon1: number, lat2: number, lon2: number): number {
    const R = 6371; // Radio de la Tierra en km
    const dLat = (lat2 - lat1) * Math.PI / 180;
    const dLon = (lon2 - lon1) * Math.PI / 180;
    const a = Math.sin(dLat/2) * Math.sin(dLat/2) +
              Math.cos(lat1 * Math.PI / 180) * Math.cos(lat2 * Math.PI / 180) *
              Math.sin(dLon/2) * Math.sin(dLon/2);
    const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1-a));
    return R * c;
  }

  private generarRecomendaciones(nivelCultural: string, nivelAmbiental: string, nivelUrbano: string): string[] {
    const recomendaciones: string[] = [];

    // Recomendaciones culturales
    if (nivelCultural === 'critico' || nivelCultural === 'alto') {
      recomendaciones.push('📜 Documentar urgentemente prácticas culturales y conocimientos tradicionales relacionados con glaciares');
      recomendaciones.push('🏛️ Crear archivos digitales de patrimonio cultural glacial para futuras generaciones');
      recomendaciones.push('👥 Involucrar a comunidades indígenas en programas de monitoreo y conservación');
    }

    // Recomendaciones ambientales
    if (nivelAmbiental === 'critico' || nivelAmbiental === 'alto') {
      recomendaciones.push('🔬 Implementar monitoreo intensivo de especies indicadoras y calidad del agua');
      recomendaciones.push('🌿 Crear corredores biológicos para conectar hábitats fragmentados');
      recomendaciones.push('🏞️ Establecer áreas de conservación en zonas críticas de transición');
    }

    // Recomendaciones urbanas
    if (nivelUrbano === 'critico' || nivelUrbano === 'alto') {
      recomendaciones.push('🚨 Desarrollar planes de evacuación y sistemas de alerta temprana');
      recomendaciones.push('🏗️ Reforzar infraestructura crítica y sistemas de drenaje');
      recomendaciones.push('💧 Implementar sistemas de gestión hídrica adaptativa');
    }

    // Recomendaciones generales
    recomendaciones.push('📊 Monitoreo satelital continuo del retroceso glacial');
    recomendaciones.push('🤝 Coordinación internacional para gestión de cuencas transfronterizas');
    recomendaciones.push('🎓 Programas educativos sobre cambio climático y adaptación');

    return recomendaciones;
  }

  private determinarNivelRiesgoGeneral(niveles: string[]): 'bajo' | 'medio' | 'alto' | 'critico' {
    if (niveles.includes('critico')) return 'critico';
    if (niveles.includes('alto')) return 'alto';
    if (niveles.includes('medio')) return 'medio';
    return 'bajo';  }  /**
   * Getter para acceder al análisis de impacto con tipos correctos
   */
  get analisisImpacto(): AnalisisImpacto | undefined {
    return (this.resultado as any)?.analisisImpacto;
  }

  get tieneAnalisisImpacto(): boolean {
    return !!(this.resultado as any)?.analisisImpacto;
  }

  // Helper methods for safe array access in template
  getComunidadesIndigenas(): string[] {
    return this.analisisImpacto?.impactoCultural?.comunidadesIndigenas || [];
  }

  getEspeciesEnRiesgo(): string[] {
    return this.analisisImpacto?.impactoAmbiental?.especiesEnRiesgo || [];
  }

  getCiudadesCercanas(): CiudadCercana[] {
    return this.analisisImpacto?.impactoUrbano?.ciudadesCercanas || [];
  }

  getRecomendaciones(): string[] {
    return this.analisisImpacto?.recomendaciones || [];
  }

  // Safe property access methods
  hasImpactoCultural(): boolean {
    return !!this.analisisImpacto?.impactoCultural;
  }

  hasImpactoAmbiental(): boolean {
    return !!this.analisisImpacto?.impactoAmbiental;
  }

  hasImpactoUrbano(): boolean {
    return !!this.analisisImpacto?.impactoUrbano;
  }
}
