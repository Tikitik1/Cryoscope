import { Injectable } from '@angular/core';
import { HttpClient, HttpParams } from '@angular/common/http';
import { Observable } from 'rxjs';
import { map } from 'rxjs/operators';

// Interfaces para datos de Open-Meteo
export interface OpenMeteoResponse {
  latitude: number;
  longitude: number;
  generationtime_ms: number;
  utc_offset_seconds: number;
  timezone: string;
  timezone_abbreviation: string;
  elevation: number;
  current_weather: {
    temperature: number;
    windspeed: number;
    winddirection: number;
    weathercode: number;
    is_day: number;
    time: string;
  };  hourly: {
    time: string[];
    temperature_2m: number[];
    relative_humidity_2m: number[];
    dewpoint_2m: number[];
    apparent_temperature: number[];
    precipitation: number[];
    rain: number[];
    snowfall: number[];
    cloud_cover: number[];
    pressure_msl: number[];
    wind_speed_10m: number[];
    wind_gusts_10m: number[];
    shortwave_radiation: number[];
    uv_index: number[];
  };  daily: {
    time: string[];
    temperature_2m_max: number[];
    temperature_2m_min: number[];
    precipitation_sum: number[];
    snowfall_sum: number[];
    wind_speed_10m_max: number[];
    cloud_cover_mean: number[];
  };
}

export interface PronosticoMeteorologico {
  ubicacion: {
    nombre: string;
    latitud: number;
    longitud: number;
  };
  fechaPronostico: Date;
  actual: {
    temperatura: number;
    viento: number;
    direccionViento: number;
    codigoTiempo: number;
    esDia: boolean;
  };
  proximasHoras: {
    tiempo: Date;
    temperatura: number;
    humedad: number;
    precipitacion: number;
    lluvia: number;
    nieve: number;
    viento: number;
    rafagasViento: number;
    radiacionSolar: number;
    indiceUV: number;
    visibilidad: number;
    presion: number;
    nubosidad: number;
  }[];
  proximosDias: {
    fecha: Date;
    temperaturaMax: number;
    temperaturaMin: number;
    precipitacionTotal: number;
    nieveTotal: number;
    vientoMax: number;
    nubosidadPromedio: number;
    evapotranspiracion: number;
  }[];
}

@Injectable({
  providedIn: 'root'
})
export class WeatherService {
  private readonly BASE_URL = 'https://api.open-meteo.com/v1/forecast';

  // Ubicaciones de glaciares en Chile (Aysén-Magallanes)
  private readonly UBICACIONES_GLACIARES = [
    { nombre: 'Campo de Hielo Sur', latitud: -49.3, longitud: -73.0 },
    { nombre: 'Glaciar O\'Higgins', latitud: -48.8, longitud: -72.9 },
    { nombre: 'Glaciar Upsala', latitud: -49.9, longitud: -73.3 },
    { nombre: 'Glaciar Spegazzini', latitud: -49.7, longitud: -73.2 },
    { nombre: 'Glaciar Perito Moreno', latitud: -50.5, longitud: -73.1 },
    { nombre: 'Glaciar Tyndall', latitud: -50.9, longitud: -73.4 },
    { nombre: 'Campo de Hielo Norte', latitud: -46.8, longitud: -73.5 },
    { nombre: 'Glaciar San Rafael', latitud: -46.7, longitud: -73.8 }
  ];

  constructor(private http: HttpClient) {}

  /**
   * Obtiene pronóstico meteorológico para todas las ubicaciones de glaciares
   */
  obtenerPronosticoGlaciares(): Observable<PronosticoMeteorologico[]> {
    const pronosticos = this.UBICACIONES_GLACIARES.map(ubicacion => 
      this.obtenerPronosticoPorUbicacion(ubicacion.latitud, ubicacion.longitud, ubicacion.nombre)
    );

    // Combinar todas las peticiones
    return new Observable(observer => {
      Promise.all(pronosticos.map(p => p.toPromise()))
        .then(resultados => {
          observer.next(resultados.filter(r => r !== undefined) as PronosticoMeteorologico[]);
          observer.complete();
        })
        .catch(error => observer.error(error));
    });
  }

  /**
   * Obtiene pronóstico para una ubicación específica
   */
  obtenerPronosticoPorUbicacion(
    latitud: number, 
    longitud: number, 
    nombreUbicacion: string = 'Ubicación desconocida'
  ): Observable<PronosticoMeteorologico> {    const params = new HttpParams({
      fromObject: {
        latitude: latitud.toString(),
        longitude: longitud.toString(),
        hourly: [
          'temperature_2m',
          'relative_humidity_2m',
          'dewpoint_2m',
          'apparent_temperature',
          'precipitation',
          'rain',
          'snowfall',
          'cloud_cover',
          'pressure_msl',
          'wind_speed_10m',
          'wind_gusts_10m',
          'shortwave_radiation',
          'uv_index'
        ].join(','),
        daily: [
          'temperature_2m_max',
          'temperature_2m_min',
          'precipitation_sum',
          'snowfall_sum',
          'wind_speed_10m_max',
          'cloud_cover_mean'
        ].join(','),
        current_weather: 'true',
        timezone: 'America/Santiago'
      }
    });

    return this.http.get<OpenMeteoResponse>(this.BASE_URL, { params })
      .pipe(
        map(response => this.transformarRespuestaOpenMeteo(response, nombreUbicacion))
      );
  }

  /**
   * Obtiene pronóstico para coordenadas específicas (para icebergs)
   */
  obtenerPronosticoPorCoordenadas(
    latitud: number, 
    longitud: number
  ): Observable<PronosticoMeteorologico> {
    return this.obtenerPronosticoPorUbicacion(
      latitud, 
      longitud, 
      `Iceberg (${latitud.toFixed(2)}, ${longitud.toFixed(2)})`
    );
  }

  /**
   * Transforma la respuesta de Open-Meteo a nuestro formato interno
   */
  private transformarRespuestaOpenMeteo(
    response: OpenMeteoResponse, 
    nombreUbicacion: string
  ): PronosticoMeteorologico {    const proximasHoras = response.hourly.time.slice(0, 24).map((tiempo, index) => ({
      tiempo: new Date(tiempo),
      temperatura: response.hourly.temperature_2m[index],
      humedad: response.hourly.relative_humidity_2m[index],
      precipitacion: response.hourly.precipitation[index],
      lluvia: response.hourly.rain[index],
      nieve: response.hourly.snowfall[index],
      viento: response.hourly.wind_speed_10m[index],
      rafagasViento: response.hourly.wind_gusts_10m[index],
      radiacionSolar: response.hourly.shortwave_radiation[index],
      indiceUV: response.hourly.uv_index[index],
      visibilidad: 10000, // Valor por defecto ya que no está disponible en la API
      presion: response.hourly.pressure_msl[index],
      nubosidad: response.hourly.cloud_cover[index]
    }));    const proximosDias = response.daily.time.slice(0, 7).map((fecha, index) => ({
      fecha: new Date(fecha),
      temperaturaMax: response.daily.temperature_2m_max[index],
      temperaturaMin: response.daily.temperature_2m_min[index],
      precipitacionTotal: response.daily.precipitation_sum[index],
      nieveTotal: response.daily.snowfall_sum[index],
      vientoMax: response.daily.wind_speed_10m_max[index],
      nubosidadPromedio: response.daily.cloud_cover_mean[index],
      evapotranspiracion: 0 // Valor por defecto ya que no está disponible en la API
    }));

    return {
      ubicacion: {
        nombre: nombreUbicacion,
        latitud: response.latitude,
        longitud: response.longitude
      },
      fechaPronostico: new Date(),
      actual: {
        temperatura: response.current_weather.temperature,
        viento: response.current_weather.windspeed,
        direccionViento: response.current_weather.winddirection,
        codigoTiempo: response.current_weather.weathercode,
        esDia: response.current_weather.is_day === 1
      },
      proximasHoras,
      proximosDias
    };
  }

  /**
   * Obtiene las ubicaciones de glaciares disponibles
   */
  obtenerUbicacionesGlaciares() {
    return this.UBICACIONES_GLACIARES;
  }
}
