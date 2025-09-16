import { Injectable } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable, of, forkJoin } from 'rxjs';
import { map, catchError } from 'rxjs/operators';

export interface DatosMeteorologicos {
  temperatura: number;
  temperaturaMinima: number;
  temperaturaMaxima: number;
  humedad: number;
  precipitacion: number;
  velocidadViento: number;
  direccionViento: number;
  presionAtmosferica: number;
  radiacionSolar: number;
  nieveAcumulada: number;
  timestamp: Date;
  ubicacion: {
    latitud: number;
    longitud: number;
    nombre: string;
  };
}

export interface CondicionesAlerta {
  temperatura: number;         // °C
  radiacionSolar: number;      // W/m²
  precipitacion: number;       // mm en 24h
  viento: number;              // km/h
  nieveAcumulada: number;      // cm
  nivelAgua: number;           // en metros
  caudal: number;              // m³/s
  sismoMagnitud: number;       // Magnitud Richter
}

export interface Alerta {
  tipo: 'temperatura' | 'radiacion' | 'lluvia' | 'viento' | 'nieve' | 'nivel_agua' | 'caudal' | 'sismo' | 'deshielo';
  nivel: 'verde' | 'amarilla' | 'naranja' | 'roja';
  mensaje: string;
  valorActual: number;
  umbral: number;
  prioridad: number; // 1-4 (1=más crítico)
  timestamp: Date;
}

@Injectable({
  providedIn: 'root'
})
export class OpenMeteoService {
  private readonly API_BASE = 'https://api.open-meteo.com/v1';

  constructor(private http: HttpClient) {}
  /**
   * Obtiene datos meteorológicos reales para una ubicación específica
   */
  obtenerDatosMeteorologicos(lat: number, lng: number, nombre: string): Observable<DatosMeteorologicos> {
    const url = `${this.API_BASE}/forecast?latitude=${lat}&longitude=${lng}&current=temperature_2m,relative_humidity_2m,precipitation,wind_speed_10m,wind_direction_10m,pressure_msl,shortwave_radiation,snowfall&daily=precipitation_sum&timezone=auto`;
    
    return this.http.get<any>(url).pipe(
      map(response => {
        const current = response.current;
        const daily = response.daily;
        return {
          temperatura: current.temperature_2m || 0,
          temperaturaMinima: current.temperature_2m || 0,
          temperaturaMaxima: current.temperature_2m || 0,
          humedad: current.relative_humidity_2m || 0,
          precipitacion: daily?.precipitation_sum?.[0] || current.precipitation || 0,
          velocidadViento: current.wind_speed_10m || 0,
          direccionViento: current.wind_direction_10m || 0,
          presionAtmosferica: current.pressure_msl || 0,
          radiacionSolar: current.shortwave_radiation || 0,
          nieveAcumulada: current.snowfall || 0,
          timestamp: new Date(),
          ubicacion: {
            latitud: lat,
            longitud: lng,
            nombre: nombre
          }
        } as DatosMeteorologicos;
      }),
      catchError(error => {
        console.error('Error obteniendo datos meteorológicos:', error);
        return of({
          temperatura: 0,
          temperaturaMinima: 0,
          temperaturaMaxima: 0,
          humedad: 0,
          precipitacion: 0,
          velocidadViento: 0,
          direccionViento: 0,
          presionAtmosferica: 0,
          radiacionSolar: 0,
          nieveAcumulada: 0,
          timestamp: new Date(),
          ubicacion: { latitud: lat, longitud: lng, nombre: nombre }
        } as DatosMeteorologicos);
      })
    );
  }  /**
   * Obtiene datos meteorológicos para múltiples ubicaciones de glaciares
   */
  obtenerDatosGlaciares(): Observable<DatosMeteorologicos[]> {
    // Ubicaciones de glaciares principales en la Región de Aysén
    const ubicacionesGlaciares = [
      { lat: -46.6833, lng: -73.8333, nombre: 'Glaciar San Rafael' },
      { lat: -48.0167, lng: -73.5333, nombre: 'Glaciar Jorge Montt' },
      { lat: -48.8833, lng: -72.9167, nombre: 'Glaciar O\'Higgins' },
      { lat: -50.9833, lng: -73.5167, nombre: 'Glaciar Tyndall' },
      { lat: -47.0000, lng: -73.5000, nombre: 'Campo de Hielo Norte' },
      { lat: -49.5000, lng: -73.0000, nombre: 'Campo de Hielo Sur' }
    ];

    // Crear array de observables para cada ubicación
    const requests = ubicacionesGlaciares.map(ubicacion => 
      this.obtenerDatosMeteorologicos(ubicacion.lat, ubicacion.lng, ubicacion.nombre)
    );

    // Usar forkJoin para combinar todas las peticiones
    return requests.length > 0 ? 
      forkJoin(requests) : 
      of([]);
  }

  /**
   * 🚨 FUNCIÓN PRINCIPAL: Evalúa las condiciones meteorológicas y genera alertas
   */
  evaluarAlertas(condiciones: CondicionesAlerta): Alerta[] {
    const alertas: Alerta[] = [];
    const timestamp = new Date();

    // 🌡️ EVALUACIÓN DE TEMPERATURA
    if (condiciones.temperatura > 10) {
      alertas.push({
        tipo: 'temperatura',
        nivel: 'roja',
        mensaje: 'Temperatura crítica: Fusión acelerada del glaciar',
        valorActual: condiciones.temperatura,
        umbral: 10,
        prioridad: 1,
        timestamp
      });
    } else if (condiciones.temperatura > 5) {
      alertas.push({
        tipo: 'temperatura',
        nivel: 'naranja',
        mensaje: 'Temperatura elevada: Riesgo de deshielo acelerado',
        valorActual: condiciones.temperatura,
        umbral: 5,
        prioridad: 2,
        timestamp
      });
    } else if (condiciones.temperatura > 0) {
      alertas.push({
        tipo: 'temperatura',
        nivel: 'amarilla',
        mensaje: 'Temperatura sobre el punto de congelación',
        valorActual: condiciones.temperatura,
        umbral: 0,
        prioridad: 3,
        timestamp
      });
    }

    // ☀️ EVALUACIÓN DE RADIACIÓN SOLAR
    if (condiciones.radiacionSolar > 600) {
      alertas.push({
        tipo: 'radiacion',
        nivel: 'roja',
        mensaje: 'Radiación solar extrema: Riesgo de deshielo masivo',
        valorActual: condiciones.radiacionSolar,
        umbral: 600,
        prioridad: 1,
        timestamp
      });
    } else if (condiciones.radiacionSolar > 400) {
      alertas.push({
        tipo: 'radiacion',
        nivel: 'naranja',
        mensaje: 'Radiación solar alta: Monitorear deshielo glaciar',
        valorActual: condiciones.radiacionSolar,
        umbral: 400,
        prioridad: 2,
        timestamp
      });
    }

    // 🌧️ EVALUACIÓN DE PRECIPITACIÓN
    if (condiciones.precipitacion > 50) {
      alertas.push({
        tipo: 'lluvia',
        nivel: 'roja',
        mensaje: 'Lluvia intensa: Alto riesgo de aluvión y crecidas',
        valorActual: condiciones.precipitacion,
        umbral: 50,
        prioridad: 1,
        timestamp
      });
    } else if (condiciones.precipitacion > 30) {
      alertas.push({
        tipo: 'lluvia',
        nivel: 'naranja',
        mensaje: 'Lluvia moderada: Riesgo de crecidas en ríos glaciares',
        valorActual: condiciones.precipitacion,
        umbral: 30,
        prioridad: 2,
        timestamp
      });
    }

    // 💨 EVALUACIÓN DE VIENTO
    if (condiciones.viento > 70) {
      alertas.push({
        tipo: 'viento',
        nivel: 'roja',
        mensaje: 'Vientos extremos: Riesgo de desprendimientos de hielo',
        valorActual: condiciones.viento,
        umbral: 70,
        prioridad: 1,
        timestamp
      });
    } else if (condiciones.viento > 50) {
      alertas.push({
        tipo: 'viento',
        nivel: 'naranja',
        mensaje: 'Vientos fuertes: Monitorear estabilidad glaciar',
        valorActual: condiciones.viento,
        umbral: 50,
        prioridad: 2,
        timestamp
      });
    }

    // ❄️ EVALUACIÓN DE NIEVE ACUMULADA
    if (condiciones.nieveAcumulada > 50) {
      alertas.push({
        tipo: 'nieve',
        nivel: 'roja',
        mensaje: 'Nieve acumulada crítica: Riesgo de avalanchas',
        valorActual: condiciones.nieveAcumulada,
        umbral: 50,
        prioridad: 1,
        timestamp
      });
    }

    // 🌊 EVALUACIÓN DE NIVEL DE AGUA
    if (condiciones.nivelAgua > 5) {
      alertas.push({
        tipo: 'nivel_agua',
        nivel: 'roja',
        mensaje: 'Nivel de agua crítico: Riesgo de inundaciones',
        valorActual: condiciones.nivelAgua,
        umbral: 5,
        prioridad: 1,
        timestamp
      });
    } else if (condiciones.nivelAgua > 3) {
      alertas.push({
        tipo: 'nivel_agua',
        nivel: 'naranja',
        mensaje: 'Nivel de agua elevado: Monitorear cauces',
        valorActual: condiciones.nivelAgua,
        umbral: 3,
        prioridad: 2,
        timestamp
      });
    }

    // 🏔️ EVALUACIÓN DE CAUDAL
    if (condiciones.caudal > 100) {
      alertas.push({
        tipo: 'caudal',
        nivel: 'roja',
        mensaje: 'Caudal extremo: Riesgo de desbordamiento',
        valorActual: condiciones.caudal,
        umbral: 100,
        prioridad: 1,
        timestamp
      });
    } else if (condiciones.caudal > 50) {
      alertas.push({
        tipo: 'caudal',
        nivel: 'naranja',
        mensaje: 'Caudal elevado: Vigilar ríos glaciares',
        valorActual: condiciones.caudal,
        umbral: 50,
        prioridad: 2,
        timestamp
      });
    }

    // 🔴 EVALUACIÓN SÍSMICA
    if (condiciones.sismoMagnitud > 4) {
      alertas.push({
        tipo: 'sismo',
        nivel: 'roja',
        mensaje: 'Sismo fuerte: Riesgo de desprendimientos glaciares',
        valorActual: condiciones.sismoMagnitud,
        umbral: 4,
        prioridad: 1,
        timestamp
      });
    } else if (condiciones.sismoMagnitud > 3) {
      alertas.push({
        tipo: 'sismo',
        nivel: 'naranja',
        mensaje: 'Sismo moderado: Monitorear estabilidad glaciar',
        valorActual: condiciones.sismoMagnitud,
        umbral: 3,
        prioridad: 2,
        timestamp
      });
    }

    // 🧊 EVALUACIÓN COMBINADA DE DESHIELO
    if (condiciones.temperatura > 5 && condiciones.radiacionSolar > 400) {
      alertas.push({
        tipo: 'deshielo',
        nivel: 'roja',
        mensaje: 'Condiciones críticas de deshielo: Temperatura + radiación solar',
        valorActual: condiciones.temperatura + (condiciones.radiacionSolar / 100),
        umbral: 9,
        prioridad: 1,
        timestamp
      });
    }

    // Ordenar alertas por prioridad (más críticas primero)
    return alertas.sort((a, b) => a.prioridad - b.prioridad);
  }

  /**
   * Convierte datos meteorológicos a condiciones de alerta
   */
  convertirACondicionesAlerta(datos: DatosMeteorologicos, 
                             nivelAgua: number = 0, 
                             caudal: number = 0, 
                             sismoMagnitud: number = 0): CondicionesAlerta {
    return {
      temperatura: datos.temperatura,
      radiacionSolar: datos.radiacionSolar,
      precipitacion: datos.precipitacion,
      viento: datos.velocidadViento,
      nieveAcumulada: datos.nieveAcumulada,
      nivelAgua: nivelAgua,
      caudal: caudal,
      sismoMagnitud: sismoMagnitud
    };
  }
}
