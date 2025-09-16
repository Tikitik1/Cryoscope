import { Injectable } from '@angular/core';
import { Observable, forkJoin, of } from 'rxjs';
import { map, catchError } from 'rxjs/operators';
import { WeatherService, PronosticoMeteorologico } from './weather.service';
import { AysenMeteoService, DatosMeteorologicosCuadricula } from './aysen-meteo.service';

// Interfaces para el sistema de riesgo
export interface VariableRiesgo {
  nombre: string;
  valor: number;
  peso: number;        // Peso en el cálculo total (0-1)
  puntaje: number;     // Puntaje calculado (0-100)
  nivel: 'bajo' | 'moderado' | 'alto' | 'extremo';
  descripcion: string;
}

export interface EvaluacionRiesgo {
  ubicacion: {
    nombre: string;
    latitud: number;
    longitud: number;
  };
  timestamp: Date;
  variables: VariableRiesgo[];
  puntajeTotal: number;      // 0-100
  nivelRiesgoGlobal: 'verde' | 'amarillo' | 'naranja' | 'rojo';
  confianza: number;         // Nivel de confianza del pronóstico (0-100)
  tendencia: 'mejorando' | 'estable' | 'empeorando';
  alertasGeneradas: string[];
  recomendaciones: string[];
  validoHasta: Date;
}

export interface ConfiguracionUmbrales {
  temperatura: {
    bajo: number;      // < 5°C
    moderado: number;  // 5-10°C
    alto: number;      // 10-15°C
    extremo: number;   // > 15°C
  };
  viento: {
    bajo: number;      // < 30 km/h
    moderado: number;  // 30-50 km/h
    alto: number;      // 50-70 km/h
    extremo: number;   // > 70 km/h
  };
  precipitacion: {
    bajo: number;      // < 10 mm
    moderado: number;  // 10-30 mm
    alto: number;      // 30-50 mm
    extremo: number;   // > 50 mm
  };
  radiacionSolar: {
    bajo: number;      // < 200 W/m²
    moderado: number;  // 200-400 W/m²
    alto: number;      // 400-600 W/m²
    extremo: number;   // > 600 W/m²
  };
  nieve: {
    bajo: number;      // < 5 cm
    moderado: number;  // 5-15 cm
    alto: number;      // 15-30 cm
    extremo: number;   // > 30 cm
  };
}

@Injectable({
  providedIn: 'root'
})
export class RiesgoService {
  
  // Configuración de umbrales críticos para glaciares patagónicos
  private readonly UMBRALES: ConfiguracionUmbrales = {
    temperatura: {
      bajo: 5,      // Temperatura normal para glaciares
      moderado: 10,  // Comienza deshielo moderado
      alto: 15,     // Deshielo significativo
      extremo: 20   // Fusión crítica
    },
    viento: {
      bajo: 30,     // Vientos normales
      moderado: 50, // Vientos fuertes
      alto: 70,     // Vientos muy fuertes
      extremo: 100  // Vientos extremos
    },
    precipitacion: {
      bajo: 10,     // Lluvia ligera
      moderado: 30, // Lluvia moderada
      alto: 50,     // Lluvia intensa
      extremo: 80   // Lluvia torrencial
    },
    radiacionSolar: {
      bajo: 200,    // Radiación baja
      moderado: 400, // Radiación moderada
      alto: 600,    // Radiación alta
      extremo: 800  // Radiación extrema
    },
    nieve: {
      bajo: 5,      // Nevada ligera
      moderado: 15, // Nevada moderada
      alto: 30,     // Nevada intensa
      extremo: 50   // Nevada extrema
    }
  };

  // Pesos para cada variable en el cálculo de riesgo total
  private readonly PESOS = {
    temperatura: 0.3,      // 30% - Factor más crítico para glaciares
    viento: 0.15,          // 15% - Importante para estabilidad
    precipitacion: 0.2,    // 20% - Afecta erosión y caudales
    radiacionSolar: 0.25,  // 25% - Factor crítico para deshielo
    nieve: 0.1             // 10% - Afecta acumulación
  };

  constructor(private weatherService: WeatherService, private aysenMeteoService: AysenMeteoService) {}  /**
   * Evalúa el riesgo total para todas las ubicaciones de glaciares
   */
  evaluarRiesgoGlobal(): Observable<EvaluacionRiesgo[]> {
    return this.weatherService.obtenerPronosticoGlaciares().pipe(
      map((pronosticos: PronosticoMeteorologico[]) => {
        if (!pronosticos || pronosticos.length === 0) {
          console.warn('No se pudieron obtener datos meteorológicos');
          return [];
        }
        return pronosticos.map(p => this.calcularRiesgoUbicacion(p));
      }),
      catchError(error => {
        console.error('Error obteniendo datos meteorológicos:', error);
        return of([]);
      })
    );
  }

  /**
   * Evalúa el riesgo para una ubicación específica
   */
  evaluarRiesgoUbicacion(latitud: number, longitud: number): Observable<EvaluacionRiesgo> {
    return this.weatherService.obtenerPronosticoPorUbicacion(latitud, longitud).pipe(
      map((pronostico: PronosticoMeteorologico) => this.calcularRiesgoUbicacion(pronostico)),
      catchError(error => {
        console.error('Error obteniendo datos para ubicación específica:', error);
        // Retornar evaluación indicando que no hay datos disponibles
        return of(this.crearEvaluacionNoDisponible(latitud, longitud));
      })
    );
  }

  /**
   * Calcula el riesgo para una ubicación basado en pronóstico meteorológico
   */
  private calcularRiesgoUbicacion(pronostico: PronosticoMeteorologico): EvaluacionRiesgo {
    const timestamp = new Date();
    const variables: VariableRiesgo[] = [];

    // Evaluar cada variable meteorológica
    const tempVariable = this.evaluarTemperatura(pronostico);
    const vientoVariable = this.evaluarViento(pronostico);
    const precipitacionVariable = this.evaluarPrecipitacion(pronostico);
    const radiacionVariable = this.evaluarRadiacion(pronostico);
    const nieveVariable = this.evaluarNieve(pronostico);

    variables.push(tempVariable, vientoVariable, precipitacionVariable, radiacionVariable, nieveVariable);

    // Calcular puntaje total ponderado
    const puntajeTotal = this.calcularPuntajeTotal(variables);
    
    // Determinar nivel de riesgo global
    const nivelRiesgoGlobal = this.determinarNivelRiesgoGlobal(puntajeTotal);
    
    // Calcular confianza y tendencia
    const confianza = this.calcularConfianza(pronostico);
    const tendencia = this.determinarTendencia(pronostico);
    
    // Generar alertas y recomendaciones
    const alertasGeneradas = this.generarAlertas(variables, nivelRiesgoGlobal);
    const recomendaciones = this.generarRecomendaciones(variables, nivelRiesgoGlobal);

    return {
      ubicacion: pronostico.ubicacion,
      timestamp,
      variables,
      puntajeTotal,
      nivelRiesgoGlobal,
      confianza,
      tendencia,
      alertasGeneradas,
      recomendaciones,
      validoHasta: new Date(timestamp.getTime() + (24 * 60 * 60 * 1000)) // Válido por 24 horas
    };
  }

  /**
   * Evalúa el riesgo por temperatura
   */
  private evaluarTemperatura(pronostico: PronosticoMeteorologico): VariableRiesgo {
    const tempMax = Math.max(...pronostico.proximosDias.slice(0, 3).map(d => d.temperaturaMax));
    const tempActual = pronostico.actual.temperatura;
    const tempPromedio = (tempMax + tempActual) / 2;

    const puntaje = this.calcularPuntajeVariable(tempPromedio, this.UMBRALES.temperatura);
    const nivel = this.determinarNivelVariable(puntaje);

    return {
      nombre: 'Temperatura',
      valor: tempPromedio,
      peso: this.PESOS.temperatura,
      puntaje,
      nivel,
      descripcion: this.generarDescripcionTemperatura(tempPromedio, nivel)
    };
  }

  /**
   * Evalúa el riesgo por viento
   */
  private evaluarViento(pronostico: PronosticoMeteorologico): VariableRiesgo {
    const vientoMax = Math.max(...pronostico.proximosDias.slice(0, 3).map(d => d.vientoMax));
    const vientoActual = pronostico.actual.viento;
    const vientoPromedio = Math.max(vientoMax, vientoActual);

    const puntaje = this.calcularPuntajeVariable(vientoPromedio, this.UMBRALES.viento);
    const nivel = this.determinarNivelVariable(puntaje);

    return {
      nombre: 'Viento',
      valor: vientoPromedio,
      peso: this.PESOS.viento,
      puntaje,
      nivel,
      descripcion: this.generarDescripcionViento(vientoPromedio, nivel)
    };
  }

  /**
   * Evalúa el riesgo por precipitación
   */
  private evaluarPrecipitacion(pronostico: PronosticoMeteorologico): VariableRiesgo {
    const precipitacionTotal = pronostico.proximosDias.slice(0, 3)
      .reduce((sum, dia) => sum + dia.precipitacionTotal, 0);
    
    const puntaje = this.calcularPuntajeVariable(precipitacionTotal, this.UMBRALES.precipitacion);
    const nivel = this.determinarNivelVariable(puntaje);

    return {
      nombre: 'Precipitación',
      valor: precipitacionTotal,
      peso: this.PESOS.precipitacion,
      puntaje,
      nivel,
      descripcion: this.generarDescripcionPrecipitacion(precipitacionTotal, nivel)
    };
  }

  /**
   * Evalúa el riesgo por radiación solar
   */
  private evaluarRadiacion(pronostico: PronosticoMeteorologico): VariableRiesgo {
    const radiacionPromedio = pronostico.proximasHoras.slice(0, 24)
      .filter(h => h.radiacionSolar > 0)
      .reduce((sum, h) => sum + h.radiacionSolar, 0) / 
      pronostico.proximasHoras.slice(0, 24).filter(h => h.radiacionSolar > 0).length || 0;

    const puntaje = this.calcularPuntajeVariable(radiacionPromedio, this.UMBRALES.radiacionSolar);
    const nivel = this.determinarNivelVariable(puntaje);

    return {
      nombre: 'Radiación Solar',
      valor: radiacionPromedio,
      peso: this.PESOS.radiacionSolar,
      puntaje,
      nivel,
      descripcion: this.generarDescripcionRadiacion(radiacionPromedio, nivel)
    };
  }

  /**
   * Evalúa el riesgo por nieve
   */
  private evaluarNieve(pronostico: PronosticoMeteorologico): VariableRiesgo {
    const nieveTotal = pronostico.proximosDias.slice(0, 3)
      .reduce((sum, dia) => sum + dia.nieveTotal, 0);
    
    const puntaje = this.calcularPuntajeVariable(nieveTotal, this.UMBRALES.nieve);
    const nivel = this.determinarNivelVariable(puntaje);

    return {
      nombre: 'Nieve',
      valor: nieveTotal,
      peso: this.PESOS.nieve,
      puntaje,
      nivel,
      descripcion: this.generarDescripcionNieve(nieveTotal, nivel)
    };
  }

  /**
   * Calcula el puntaje de una variable basado en sus umbrales
   */
  private calcularPuntajeVariable(valor: number, umbrales: any): number {
    if (valor <= umbrales.bajo) return 10;
    if (valor <= umbrales.moderado) return 35;
    if (valor <= umbrales.alto) return 65;
    if (valor <= umbrales.extremo) return 85;
    return 100; // Por encima del umbral extremo
  }

  /**
   * Determina el nivel de riesgo de una variable
   */
  private determinarNivelVariable(puntaje: number): 'bajo' | 'moderado' | 'alto' | 'extremo' {
    if (puntaje <= 25) return 'bajo';
    if (puntaje <= 50) return 'moderado';
    if (puntaje <= 75) return 'alto';
    return 'extremo';
  }

  /**
   * Calcula el puntaje total ponderado
   */
  private calcularPuntajeTotal(variables: VariableRiesgo[]): number {
    return variables.reduce((total, variable) => 
      total + (variable.puntaje * variable.peso), 0
    );
  }

  /**
   * Determina el nivel de riesgo global
   */
  private determinarNivelRiesgoGlobal(puntajeTotal: number): 'verde' | 'amarillo' | 'naranja' | 'rojo' {
    if (puntajeTotal <= 25) return 'verde';     // Riesgo bajo
    if (puntajeTotal <= 50) return 'amarillo';  // Riesgo moderado
    if (puntajeTotal <= 75) return 'naranja';   // Riesgo alto
    return 'rojo';                              // Riesgo extremo
  }

  /**
   * Calcula el nivel de confianza del pronóstico
   */
  private calcularConfianza(pronostico: PronosticoMeteorologico): number {
    // Confianza basada en consistencia de datos y tiempo de pronóstico
    let confianza = 85; // Confianza base de Open-Meteo
    
    // Reducir confianza para pronósticos más lejanos
    const diasPronostico = pronostico.proximosDias.length;
    if (diasPronostico > 3) confianza -= 10;
    if (diasPronostico > 7) confianza -= 15;
    
    return Math.max(confianza, 60); // Mínimo 60% de confianza
  }

  /**
   * Determina la tendencia del riesgo
   */
  private determinarTendencia(pronostico: PronosticoMeteorologico): 'mejorando' | 'estable' | 'empeorando' {
    const tempInicial = pronostico.proximosDias[0]?.temperaturaMax || pronostico.actual.temperatura;
    const tempFinal = pronostico.proximosDias[2]?.temperaturaMax || tempInicial;
    
    const diferencia = tempFinal - tempInicial;
    
    if (diferencia > 2) return 'empeorando';     // Temperaturas subiendo
    if (diferencia < -2) return 'mejorando';     // Temperaturas bajando
    return 'estable';                            // Sin cambios significativos
  }

  /**
   * Genera alertas basadas en variables de riesgo
   */
  private generarAlertas(variables: VariableRiesgo[], nivelGlobal: string): string[] {
    const alertas: string[] = [];
    
    variables.forEach(variable => {
      if (variable.nivel === 'extremo') {
        alertas.push(`ALERTA CRÍTICA: ${variable.nombre} en nivel extremo (${variable.valor.toFixed(1)})`);
      } else if (variable.nivel === 'alto') {
        alertas.push(`ALERTA ALTA: ${variable.nombre} en nivel alto (${variable.valor.toFixed(1)})`);
      }
    });

    if (nivelGlobal === 'rojo') {
      alertas.push('ALERTA MÁXIMA: Condiciones extremadamente peligrosas para glaciares');
    } else if (nivelGlobal === 'naranja') {
      alertas.push('ALERTA ALTA: Condiciones peligrosas detectadas');
    }

    return alertas;
  }

  /**
   * Genera recomendaciones basadas en el análisis de riesgo
   */
  private generarRecomendaciones(variables: VariableRiesgo[], nivelGlobal: string): string[] {
    const recomendaciones: string[] = [];
    
    switch (nivelGlobal) {
      case 'rojo':
        recomendaciones.push('Evacuar inmediatamente personal no esencial');
        recomendaciones.push('Activar protocolos de emergencia');
        recomendaciones.push('Monitoreo continuo 24/7');
        recomendaciones.push('Alertar a comunidades cercanas');
        break;
      case 'naranja':
        recomendaciones.push('Aumentar frecuencia de monitoreo');
        recomendaciones.push('Preparar equipos de respuesta');
        recomendaciones.push('Limitar actividades en zona de riesgo');
        break;
      case 'amarillo':
        recomendaciones.push('Mantener vigilancia elevada');
        recomendaciones.push('Verificar equipos de seguridad');
        break;
      case 'verde':
        recomendaciones.push('Continuar monitoreo rutinario');
        break;
    }

    // Recomendaciones específicas por variable
    variables.forEach(variable => {
      if (variable.nivel === 'extremo' || variable.nivel === 'alto') {
        recomendaciones.push(...this.generarRecomendacionesEspecificas(variable));
      }
    });

    return [...new Set(recomendaciones)]; // Eliminar duplicados
  }

  /**
   * Genera recomendaciones específicas por variable
   */
  private generarRecomendacionesEspecificas(variable: VariableRiesgo): string[] {
    switch (variable.nombre) {
      case 'Temperatura':
        return ['Monitorear deshielo glacial', 'Evaluar estabilidad de seracs'];
      case 'Viento':
        return ['Asegurar equipos móviles', 'Suspender vuelos de reconocimiento'];
      case 'Precipitación':
        return ['Monitorear caudales', 'Evaluar riesgo de aluviones'];
      case 'Radiación Solar':
        return ['Proteger equipos sensibles', 'Monitorear formación de lagos glaciales'];
      case 'Nieve':
        return ['Evaluar riesgo de avalanchas', 'Revisar accesos y rutas'];
      default:
        return [];
    }
  }

  // Métodos para generar descripciones específicas de cada variable
  private generarDescripcionTemperatura(valor: number, nivel: string): string {
    if (nivel === 'extremo') return `Temperatura crítica de ${valor.toFixed(1)}°C - Fusión glacial acelerada`;
    if (nivel === 'alto') return `Temperatura alta de ${valor.toFixed(1)}°C - Deshielo significativo`;
    if (nivel === 'moderado') return `Temperatura moderada de ${valor.toFixed(1)}°C - Deshielo normal`;
    return `Temperatura normal de ${valor.toFixed(1)}°C - Condiciones estables`;
  }

  private generarDescripcionViento(valor: number, nivel: string): string {
    if (nivel === 'extremo') return `Vientos extremos de ${valor.toFixed(1)} km/h - Condiciones peligrosas`;
    if (nivel === 'alto') return `Vientos fuertes de ${valor.toFixed(1)} km/h - Precaución requerida`;
    if (nivel === 'moderado') return `Vientos moderados de ${valor.toFixed(1)} km/h - Condiciones normales`;
    return `Vientos ligeros de ${valor.toFixed(1)} km/h - Condiciones ideales`;
  }

  private generarDescripcionPrecipitacion(valor: number, nivel: string): string {
    if (nivel === 'extremo') return `Precipitación extrema de ${valor.toFixed(1)} mm - Riesgo de inundaciones`;
    if (nivel === 'alto') return `Precipitación intensa de ${valor.toFixed(1)} mm - Aumento de caudales`;
    if (nivel === 'moderado') return `Precipitación moderada de ${valor.toFixed(1)} mm - Condiciones normales`;
    return `Precipitación ligera de ${valor.toFixed(1)} mm - Condiciones estables`;
  }

  private generarDescripcionRadiacion(valor: number, nivel: string): string {
    if (nivel === 'extremo') return `Radiación extrema de ${valor.toFixed(0)} W/m² - Deshielo intenso`;
    if (nivel === 'alto') return `Radiación alta de ${valor.toFixed(0)} W/m² - Deshielo moderado`;
    if (nivel === 'moderado') return `Radiación moderada de ${valor.toFixed(0)} W/m² - Deshielo normal`;
    return `Radiación baja de ${valor.toFixed(0)} W/m² - Mínimo deshielo`;
  }

  private generarDescripcionNieve(valor: number, nivel: string): string {
    if (nivel === 'extremo') return `Nevada extrema de ${valor.toFixed(1)} cm - Riesgo de avalanchas`;
    if (nivel === 'alto') return `Nevada intensa de ${valor.toFixed(1)} cm - Acumulación significativa`;
    if (nivel === 'moderado') return `Nevada moderada de ${valor.toFixed(1)} cm - Acumulación normal`;
    return `Nevada ligera de ${valor.toFixed(1)} cm - Condiciones estables`;
  }
  /**
   * Genera evaluaciones de riesgo simuladas para múltiples ubicaciones
   */
  private crearEvaluacionNoDisponible(latitud: number, longitud: number, nombre?: string): EvaluacionRiesgo {
    const timestamp = new Date();
    
    // Variables vacías indicando que no hay datos
    const variables: VariableRiesgo[] = [
      {
        nombre: 'Temperatura',
        valor: 0,
        peso: this.PESOS.temperatura,
        puntaje: 0,
        nivel: 'bajo',
        descripcion: 'Datos no disponibles - sin conexión a API meteorológica'
      },
      {
        nombre: 'Viento',
        valor: 0,
        peso: this.PESOS.viento,
        puntaje: 0,
        nivel: 'bajo',
        descripcion: 'Datos no disponibles - sin conexión a API meteorológica'
      },
      {
        nombre: 'Precipitación',
        valor: 0,
        peso: this.PESOS.precipitacion,
        puntaje: 0,
        nivel: 'bajo',
        descripcion: 'Datos no disponibles - sin conexión a API meteorológica'
      },
      {
        nombre: 'Radiación Solar',
        valor: 0,
        peso: this.PESOS.radiacionSolar,
        puntaje: 0,
        nivel: 'bajo',
        descripcion: 'Datos no disponibles - sin conexión a API meteorológica'
      },
      {
        nombre: 'Nieve',
        valor: 0,
        peso: this.PESOS.nieve,
        puntaje: 0,
        nivel: 'bajo',
        descripcion: 'Datos no disponibles - sin conexión a API meteorológica'
      }
    ];

    return {
      ubicacion: {
        nombre: nombre || `Ubicación ${latitud.toFixed(2)}, ${longitud.toFixed(2)}`,
        latitud,
        longitud
      },
      timestamp,
      variables,
      puntajeTotal: 0,
      nivelRiesgoGlobal: 'verde',
      confianza: 0,
      tendencia: 'estable',
      alertasGeneradas: ['Sistema sin datos meteorológicos'],
      recomendaciones: ['Verificar conexión a internet', 'Contactar con administrador del sistema'],
      validoHasta: new Date(timestamp.getTime() + (24 * 60 * 60 * 1000))
    };
  }

  /**
   * Evalúa el riesgo específico para las cuadrículas de Aysén
   */  evaluarRiesgoAysen(): Observable<EvaluacionRiesgo[]> {
    console.log('🔍 Evaluando riesgo específico para zonas de Aysén...');
    
    return this.aysenMeteoService.obtenerDatosTodasCuadriculas().pipe(
      map((datosCuadriculas: DatosMeteorologicosCuadricula[]) => {
        if (!datosCuadriculas || datosCuadriculas.length === 0) {
          console.warn('No se pudieron obtener datos meteorológicos de Aysén');
          return [];
        }
        return datosCuadriculas.map(datos => this.calcularRiesgoDesdeAysen(datos));
      }),
      catchError(error => {
        console.error('Error evaluando riesgo en Aysén:', error);
        return of([]);
      })
    );
  }  /**
   * Calcula el riesgo desde datos de zonas de Aysén
   */
  private calcularRiesgoDesdeAysen(datos: DatosMeteorologicosCuadricula): EvaluacionRiesgo {
    // Crear una ubicación por defecto ya que no podemos obtener la cuadrícula sincrónicamente
    const ubicacionDefault = {
      nombre: `Cuadrícula ${datos.cuadriculaId}`,
      latitud: -47.0,
      longitud: -73.0
    };
    
    const variables: VariableRiesgo[] = [
      {
        nombre: 'Temperatura',
        valor: datos.temperatura.actual,
        peso: this.PESOS.temperatura,
        puntaje: this.calcularPuntajeVariable(datos.temperatura.actual, this.UMBRALES.temperatura),
        nivel: this.determinarNivelVariable(this.calcularPuntajeVariable(datos.temperatura.actual, this.UMBRALES.temperatura)),
        descripcion: `Temperatura actual: ${datos.temperatura.actual.toFixed(1)}°C (máx: ${datos.temperatura.maxima.toFixed(1)}°C)`
      },
      {
        nombre: 'Viento',
        valor: datos.viento.velocidad,
        peso: this.PESOS.viento,
        puntaje: this.calcularPuntajeVariable(datos.viento.velocidad, this.UMBRALES.viento),
        nivel: this.determinarNivelVariable(this.calcularPuntajeVariable(datos.viento.velocidad, this.UMBRALES.viento)),
        descripcion: `Viento: ${datos.viento.velocidad.toFixed(1)} km/h desde ${datos.viento.direccion}°`
      },
      {
        nombre: 'Precipitación',
        valor: datos.precipitacion,
        peso: this.PESOS.precipitacion,
        puntaje: this.calcularPuntajeVariable(datos.precipitacion, this.UMBRALES.precipitacion),
        nivel: this.determinarNivelVariable(this.calcularPuntajeVariable(datos.precipitacion, this.UMBRALES.precipitacion)),
        descripcion: `Precipitación: ${datos.precipitacion.toFixed(1)} mm`
      },
      {
        nombre: 'Radiación Solar',
        valor: datos.radiacionSolar,
        peso: this.PESOS.radiacionSolar,
        puntaje: this.calcularPuntajeVariable(datos.radiacionSolar, this.UMBRALES.radiacionSolar),
        nivel: this.determinarNivelVariable(this.calcularPuntajeVariable(datos.radiacionSolar, this.UMBRALES.radiacionSolar)),
        descripcion: `Radiación solar: ${datos.radiacionSolar.toFixed(1)} MJ/m²`
      },
      {
        nombre: 'Humedad',
        valor: datos.humedad,
        peso: 0.1,
        puntaje: Math.min(100, Math.max(0, datos.humedad)),
        nivel: datos.humedad > 80 ? 'alto' : datos.humedad > 60 ? 'moderado' : 'bajo',
        descripcion: `Humedad relativa: ${datos.humedad.toFixed(1)}%`
      }
    ];

    const puntajeTotal = this.calcularPuntajeTotal(variables);
    const nivelRiesgoGlobal = this.determinarNivelRiesgoGlobal(puntajeTotal);
    const tendencia = this.determinarTendenciaAysen(datos);
    
    return {
      ubicacion: ubicacionDefault,
      timestamp: datos.timestamp,
      variables,
      puntajeTotal,
      nivelRiesgoGlobal,
      confianza: this.calcularConfianzaAysen(datos),
      tendencia,
      alertasGeneradas: datos.alertas,
      recomendaciones: this.generarRecomendacionesAysen(datos, null),
      validoHasta: new Date(Date.now() + (6 * 60 * 60 * 1000)) // 6 horas
    };
  }

  /**
   * Calcula confianza específica para datos de Aysén
   */
  private calcularConfianzaAysen(datos: DatosMeteorologicosCuadricula): number {
    let confianza = 100;
    
    if (!datos.temperatura.actual) confianza -= 20;
    if (!datos.viento.velocidad) confianza -= 15;
    if (!datos.radiacionSolar) confianza -= 15;
    if (!datos.precipitacion && datos.precipitacion !== 0) confianza -= 10;
    
    return Math.max(confianza, 50); // Mínimo 50% de confianza
  }

  /**
   * Determina tendencia específica para datos de Aysén
   */
  private determinarTendenciaAysen(datos: DatosMeteorologicosCuadricula): 'mejorando' | 'estable' | 'empeorando' {
    if (datos.temperatura.actual > datos.temperatura.maxima * 0.8) {
      return 'empeorando';
    }
    if (datos.temperatura.actual < datos.temperatura.minima * 1.2) {
      return 'mejorando';
    }
    return 'estable';
  }

  /**
   * Genera recomendaciones específicas para Aysén
   */
  private generarRecomendacionesAysen(datos: DatosMeteorologicosCuadricula, cuadricula: any): string[] {
    const recomendaciones: string[] = [];

    if (datos.nivelRiesgo === 'critico') {
      recomendaciones.push('🚨 Suspender actividades turísticas en glaciares');
      recomendaciones.push('📡 Intensificar monitoreo de desprendimientos');
    }

    if (datos.temperatura.actual > 2) {
      recomendaciones.push('🌡️ Monitorear caudales por derretimiento acelerado');
    }

    if (datos.viento.velocidad > 40) {
      recomendaciones.push('💨 Precaución en navegación - posible transporte de icebergs');
    }

    if (cuadricula?.prioridad === 'alta') {
      recomendaciones.push('⚠️ Zona prioritaria - mantener vigilancia continua');
    }

    if (datos.precipitacion > 20 && datos.temperatura.actual > 0) {
      recomendaciones.push('🌧️ Lluvia sobre hielo - riesgo de desprendimientos');
    }

    return recomendaciones;
  }

  /**
   * Método combinado que evalúa tanto el sistema global como Aysén
   */
  evaluarRiesgoCompleto(): Observable<EvaluacionRiesgo[]> {
    return forkJoin([
      this.evaluarRiesgoGlobal(),
      this.evaluarRiesgoAysen()
    ]).pipe(
      map(([riesgoGlobal, riesgoAysen]) => {
        // Combinar ambos sistemas priorizando los datos específicos de Aysén
        const evaluacionesCompletas = [...riesgoAysen];
        
        // Agregar evaluaciones globales que no estén cubiertas por Aysén
        riesgoGlobal.forEach(evalGlobal => {
          const yaCubierto = riesgoAysen.some(evalAysen => 
            Math.abs(evalAysen.ubicacion.latitud - evalGlobal.ubicacion.latitud) < 0.5 &&
            Math.abs(evalAysen.ubicacion.longitud - evalGlobal.ubicacion.longitud) < 0.5
          );
          
          if (!yaCubierto) {
            evaluacionesCompletas.push(evalGlobal);
          }
        });
        
        return evaluacionesCompletas;
      }),
      catchError(error => {
        console.error('Error en evaluación completa:', error);
        // Fallback al sistema global si Aysén falla
        return this.evaluarRiesgoGlobal();
      })
    );
  }
  /**
   * Obtiene el número de zonas de Aysén con datos meteorológicos reales
   */
  obtenerNumeroCuadriculasMonitoreadas(): Observable<number> {
    return this.aysenMeteoService.obtenerDatosTodasCuadriculas().pipe(
      map(datos => datos.length),
      catchError(error => {
        console.error('Error obteniendo número de zonas monitoreadas:', error);
        return of(0);
      })
    );
  }
}
