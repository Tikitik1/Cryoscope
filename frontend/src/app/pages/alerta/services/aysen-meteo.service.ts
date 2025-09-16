import { Injectable } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable, forkJoin, of } from 'rxjs';
import { map, catchError, switchMap } from 'rxjs/operators';

export interface CuadriculaAysen {
  id: string;
  grid_id: string;
  nombre: string;
  comuna: string;
  region: string;
  lat: number;
  lon: number;
  centro: {
    lat: number;
    lng: number;
  };
  prioridad: 'alta' | 'media' | 'baja';
}

export interface DatosMeteorologicosCuadricula {
  cuadriculaId: string;
  timestamp: Date;
  temperatura: {
    actual: number;
    maxima: number;
    minima: number;
  };
  precipitacion: number;
  humedad: number;
  viento: {
    velocidad: number;
    direccion: number;
  };
  radiacionSolar: number;
  nieve: number; // Nueva variable
  caudal: number; // Nueva variable
  uvIndex: number; // Nueva variable
  nivelRiesgo: 'bajo' | 'moderado' | 'alto' | 'critico';
  alertas: string[];
  // Información adicional para explicaciones detalladas
  explicacion?: {
    factorPrincipal: string;
    riesgoGlaciar: string;
    recomendaciones: string[];
  };
}

@Injectable({
  providedIn: 'root'
})
export class AysenMeteoService {
  private readonly OPEN_METEO_URL = 'https://api.open-meteo.com/v1/forecast';
  private readonly BACKEND_URL = 'http://localhost:8000/api';
  
  private cuadriculasCache: CuadriculaAysen[] = [];

  constructor(private http: HttpClient) {}

  /**
   * Obtiene las 30 cuadrículas de monitoreo desde el backend
   */
  obtenerCuadriculas(): Observable<CuadriculaAysen[]> {
    if (this.cuadriculasCache.length > 0) {
      return of(this.cuadriculasCache);
    }

    return this.http.get<any>(`${this.BACKEND_URL}/grid/cuadriculas_aysen`).pipe(
      map(response => {
        const cuadriculas = response.grid_points.map((point: any) => ({
          id: point.id,
          grid_id: point.grid_id,
          nombre: `Zona ${point.grid_id}`,
          comuna: point.comuna,
          region: point.region,
          lat: point.lat,
          lon: point.lon,
          centro: {
            lat: point.lat,
            lng: point.lon
          },
          prioridad: this.determinarPrioridad(point.comuna)
        }));
        
        this.cuadriculasCache = cuadriculas;
        console.log(`✅ Cargadas ${cuadriculas.length} cuadrículas de monitoreo desde el backend`);
        return cuadriculas;
      }),
      catchError(error => {
        console.error('Error obteniendo cuadrículas del backend:', error);
        return of(this.getCuadriculasFallback());
      })
    );
  }

  /**
   * Cuadrículas de fallback si el backend no está disponible
   */
  private getCuadriculasFallback(): CuadriculaAysen[] {
    console.warn('⚠️ Usando cuadrículas de fallback - backend no disponible');
    return [
      {
        id: 'fallback_1',
        grid_id: 'Coyhaique_1',
        nombre: 'Zona Coyhaique Norte',
        comuna: 'Coyhaique',
        region: 'Aysén',
        lat: -45.57,
        lon: -72.07,
        centro: { lat: -45.57, lng: -72.07 },
        prioridad: 'alta'
      },
      {
        id: 'fallback_2',
        grid_id: 'Aysen_1',
        nombre: 'Zona Aysén Centro',
        comuna: 'Aysén',
        region: 'Aysén',
        lat: -45.40,
        lon: -72.69,
        centro: { lat: -45.40, lng: -72.69 },
        prioridad: 'alta'
      },
      {
        id: 'fallback_3',
        grid_id: 'Chile_Chico_1',
        nombre: 'Zona Chile Chico',
        comuna: 'Chile Chico',
        region: 'Aysén',
        lat: -46.54,
        lon: -71.72,
        centro: { lat: -46.54, lng: -71.72 },
        prioridad: 'media'
      }
    ];
  }

  /**
   * Determina la prioridad basada en la comuna
   */
  private determinarPrioridad(comuna: string): 'alta' | 'media' | 'baja' {
    const comunasAlta = ['Coyhaique', 'Aysén', 'Chile Chico'];
    const comunasMedia = ['Río Ibáñez', 'Cochrane', 'O\'Higgins'];
    
    if (comunasAlta.includes(comuna)) return 'alta';
    if (comunasMedia.includes(comuna)) return 'media';
    return 'baja';
  }

  /**
   * Obtiene datos meteorológicos para todas las cuadrículas
   */
  obtenerDatosMeteorologicos(): Observable<DatosMeteorologicosCuadricula[]> {
    return this.obtenerCuadriculas().pipe(
      switchMap(cuadriculas => {
        const requests = cuadriculas.map(cuadricula => 
          this.obtenerDatosCuadricula(cuadricula)
        );
        return forkJoin(requests);
      }),
      catchError(error => {
        console.error('Error obteniendo datos meteorológicos:', error);
        return of([]);
      })
    );
  }

  /**
   * Obtiene datos meteorológicos para una cuadrícula específica
   */
  private obtenerDatosCuadricula(cuadricula: CuadriculaAysen): Observable<DatosMeteorologicosCuadricula> {
    // 1. Llamada a forecast meteorológico
    const meteoParams = {
      latitude: cuadricula.lat.toString(),
      longitude: cuadricula.lon.toString(),
      current: 'temperature_2m,relative_humidity_2m,precipitation,wind_speed_10m,wind_direction_10m,shortwave_radiation,snowfall,uv_index',
      daily: 'temperature_2m_max,temperature_2m_min,precipitation_sum,snowfall_sum,shortwave_radiation_sum,uv_index_max',
      timezone: 'America/Santiago',
      forecast_days: '1'
    };
    const meteoQuery = Object.entries(meteoParams)
      .map(([key, value]) => `${key}=${value}`)
      .join('&');
    const meteo$ = this.http.get<any>(`${this.OPEN_METEO_URL}?${meteoQuery}`);

    // Solo procesar datos meteorológicos, caudal se marca como 0 o ND
    return meteo$.pipe(
      map(meteoData => this.procesarDatosMeteorologicosSinCaudal(cuadricula, meteoData)),
      catchError(error => {
        console.error(`Error obteniendo datos para ${cuadricula.nombre}:`, error);
        return of(this.getDatosFallback(cuadricula));
      })
    );
  }

  /**
   * Procesa los datos meteorológicos cuando no hay información de caudal disponible
   */
  private procesarDatosMeteorologicosSinCaudal(cuadricula: CuadriculaAysen, data: any): DatosMeteorologicosCuadricula {
    const current = data.current || {};
    const daily = data.daily || {};
    const temperatura = current.temperature_2m || 15;
    const precipitacion = current.precipitation || 0;
    const humedad = current.relative_humidity_2m || 70;
    const velocidadViento = current.wind_speed_10m || 10;
    const radiacionSolar = current.shortwave_radiation || daily.shortwave_radiation_sum?.[0] || 500;
    const nieve = current.snowfall || daily.snowfall_sum?.[0] || 0;
    const caudal = 0; // No disponible
    const uvIndex = current.uv_index || daily.uv_index_max?.[0] || 0;
    const nivelRiesgo = this.calcularNivelRiesgo(temperatura, precipitacion, humedad);
    const datosMeteo: DatosMeteorologicosCuadricula = {
      cuadriculaId: cuadricula.id,
      timestamp: new Date(),
      temperatura: {
        actual: temperatura,
        maxima: daily.temperature_2m_max?.[0] || temperatura + 5,
        minima: daily.temperature_2m_min?.[0] || temperatura - 5
      },
      precipitacion: precipitacion,
      humedad: humedad,
      viento: {
        velocidad: velocidadViento,
        direccion: current.wind_direction_10m || 180
      },
      radiacionSolar: radiacionSolar,
      nieve: nieve,
      caudal: caudal,
      uvIndex: uvIndex,
      nivelRiesgo: nivelRiesgo,
      alertas: this.generarAlertas(temperatura, precipitacion, humedad),
      explicacion: this.generarExplicacionDetallada(temperatura, precipitacion, humedad, velocidadViento, nivelRiesgo)
    };

    return datosMeteo;
  }

  /**
   * Genera explicación detallada del riesgo basada en datos OpenMeteo
   */
  private generarExplicacionDetallada(temp: number, precip: number, humedad: number, viento: number, riesgo: string) {
    let factorPrincipal = '';
    let riesgoGlaciar = '';
    let recomendaciones: string[] = [];

    // Determinar factor principal
    if (temp > 25 && precip > 30) {
      factorPrincipal = 'Combinación crítica de temperatura extrema y precipitación torrencial';
    } else if (temp > 25) {
      factorPrincipal = 'Temperatura extremadamente alta para la región patagónica';
    } else if (precip > 50) {
      factorPrincipal = 'Precipitación torrencial con alto riesgo de crecidas';
    } else if (viento > 60) {
      factorPrincipal = 'Vientos huracanados con capacidad de transporte masivo';
    } else if (temp > 20) {
      factorPrincipal = 'Temperatura elevada que acelera procesos de deshielo';
    } else {
      factorPrincipal = 'Condiciones dentro de parámetros normales';
    }

    // Evaluar riesgo específico para glaciares
    switch (riesgo) {
      case 'critico':
        riesgoGlaciar = 'Riesgo de colapso glaciar y desprendimientos masivos de icebergs';
        recomendaciones = [
          'Evacuar inmediatamente áreas cercanas a glaciares',
          'Suspender toda actividad náutica',
          'Monitoreo continuo de niveles de agua',
          'Activar protocolos de emergencia'
        ];
        break;
      case 'alto':
        riesgoGlaciar = 'Aceleración significativa del deshielo con posible inestabilidad';
        recomendaciones = [
          'Mantener distancia de seguridad de glaciares',
          'Restricciones de navegación en zonas críticas',
          'Monitoreo cada 2 horas',
          'Preparar planes de evacuación'
        ];
        break;
      case 'moderado':
        riesgoGlaciar = 'Deshielo acelerado dentro de rangos manejables';
        recomendaciones = [
          'Precaución en actividades cercanas a glaciares',
          'Monitoreo regular cada 6 horas',
          'Informar cambios visuales en glaciares'
        ];
        break;
      default:
        riesgoGlaciar = 'Estabilidad glaciar dentro de parámetros normales';
        recomendaciones = [
          'Mantener monitoreo rutinario',
          'Condiciones favorables para actividades normales'
        ];
    }

    return {
      factorPrincipal,
      riesgoGlaciar,
      recomendaciones
    };
  }

  /**
   * Datos de fallback cuando falla la API meteorológica
   */
  private getDatosFallback(cuadricula: CuadriculaAysen): DatosMeteorologicosCuadricula {
    return {
      cuadriculaId: cuadricula.id,
      timestamp: new Date(),
      temperatura: {
        actual: 10,
        maxima: 15,
        minima: 5
      },
      precipitacion: 0,
      humedad: 70,
      viento: {
        velocidad: 12,
        direccion: 180
      },
      radiacionSolar: 400,
      nieve: 0,
      caudal: 0,
      uvIndex: 0,
      nivelRiesgo: 'moderado',
      alertas: ['Datos no disponibles - usando valores estimados']
    };
  }
  /**
   * Calcula el nivel de riesgo basado en condiciones meteorológicas
   * Utiliza datos reales de OpenMeteo para determinar el riesgo en glaciares
   */
  private calcularNivelRiesgo(temp: number, precipitacion: number, humedad: number): 'bajo' | 'moderado' | 'alto' | 'critico' {
    let riesgo = 0;

    // Temperatura: mayor riesgo con temperaturas más altas (deshielo acelerado)
    if (temp > 25) riesgo += 4; // Temperatura extrema para la Patagonia
    else if (temp > 20) riesgo += 3; // Temperatura muy alta para la región
    else if (temp > 15) riesgo += 2; // Temperatura moderada-alta
    else if (temp > 10) riesgo += 1; // Temperatura elevada para la región
    else if (temp < -5) riesgo += 1; // Congelación extrema también es riesgo

    // Precipitación: mayor riesgo con más lluvia (acelera deshielo y crecidas)
    if (precipitacion > 50) riesgo += 4; // Precipitación extrema
    else if (precipitacion > 30) riesgo += 3; // Precipitación muy alta
    else if (precipitacion > 20) riesgo += 2; // Precipitación alta
    else if (precipitacion > 10) riesgo += 1; // Precipitación moderada

    // Humedad: mayor riesgo con alta humedad (niebla y visibilidad reducida)
    if (humedad > 95) riesgo += 2; // Saturación total
    else if (humedad > 85) riesgo += 1; // Humedad muy alta

    // Combinaciones críticas específicas para glaciares
    if (temp > 15 && precipitacion > 20) riesgo += 2; // Lluvia + calor = deshielo crítico
    if (temp > 10 && precipitacion > 30) riesgo += 1; // Lluvia intensa acelera deshielo

    if (riesgo >= 8) return 'critico';
    if (riesgo >= 5) return 'alto';
    if (riesgo >= 3) return 'moderado';
    return 'bajo';
  }
  /**
   * Genera alertas específicas basadas en condiciones meteorológicas reales
   * Enfocado en riesgos glaciares y icebergs en la Región de Aysén
   */
  private generarAlertas(temp: number, precipitacion: number, humedad: number): string[] {
    const alertas: string[] = [];

    // Alertas por temperatura
    if (temp > 25) {
      alertas.push('🌡️ CRÍTICO: Temperatura extrema (>25°C) - Deshielo acelerado de glaciares');
    } else if (temp > 20) {
      alertas.push('🔥 ALTO: Temperatura muy elevada (>20°C) - Riesgo significativo de derretimiento');
    } else if (temp > 15) {
      alertas.push('⚠️ MODERADO: Temperatura alta (>15°C) - Monitorear deshielo');
    }

    // Alertas por precipitación
    if (precipitacion > 50) {
      alertas.push('🌊 CRÍTICO: Precipitación torrencial (>50mm) - Alto riesgo de crecidas súbitas');
    } else if (precipitacion > 30) {
      alertas.push('🌧️ ALTO: Lluvia intensa (>30mm) - Posible aumento crítico de caudales');
    } else if (precipitacion > 20) {
      alertas.push('☔ MODERADO: Lluvia moderada-alta (>20mm) - Vigilar niveles de agua');
    }

    // Alertas por humedad
    if (humedad > 95) {
      alertas.push('🌫️ ALTO: Saturación atmosférica (>95%) - Niebla densa, visibilidad nula');
    } else if (humedad > 90) {
      alertas.push('💨 MODERADO: Humedad muy alta (>90%) - Posible formación de niebla');
    }

    // Alertas por combinaciones críticas
    if (temp > 15 && precipitacion > 20) {
      alertas.push('⚡ CRÍTICO: Temperatura alta + lluvia intensa - Deshielo acelerado y crecidas');
    }

    if (temp > 10 && precipitacion > 30 && humedad > 90) {
      alertas.push('🚨 EMERGENCIA: Condiciones extremas combinadas - Evacuación preventiva recomendada');
    }

    // Alertas específicas para glaciares
    if (temp > 18) {
      alertas.push('🧊 GLACIAR: Temperatura crítica para estabilidad glaciar - Monitorear desprendimientos');
    }

    if (precipitacion > 25 && temp > 5) {
      alertas.push('🌊 ICEBERG: Condiciones favorables para desprendimiento de icebergs');
    }

    return alertas;
  }

  /**
   * Obtiene estadísticas generales de las cuadrículas
   */
  obtenerEstadisticas(): Observable<any> {
    return this.obtenerDatosMeteorologicos().pipe(
      map(datos => {
        const total = datos.length;
        const porRiesgo = datos.reduce((acc, dato) => {
          acc[dato.nivelRiesgo] = (acc[dato.nivelRiesgo] || 0) + 1;
          return acc;
        }, {} as any);

        const conAlertas = datos.filter(d => d.alertas.length > 0).length;

        return {
          totalCuadriculas: total,
          distribucionRiesgo: porRiesgo,
          cuadriculasConAlertas: conAlertas,
          porcentajeConAlertas: total > 0 ? Math.round((conAlertas / total) * 100) : 0
        };
      })
    );
  }

  /**
   * Método auxiliar para obtener datos con observables de forma síncrona
   */
  obtenerDatosTodasCuadriculas(): Observable<DatosMeteorologicosCuadricula[]> {
    return this.obtenerDatosMeteorologicos();
  }
}
