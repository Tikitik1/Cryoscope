export interface Temperatura {
  actual: number;
  pasada: number;
  futura: number;
  delta: number;
  unidad: string;
  fecha: string;
}

export interface Iceberg {
  id: string;
  nombre: string;
  tamano: number; // en m²
  coordenadas: {
    latitud: number;
    longitud: number;
  };
  nivelRiesgo: 'bajo' | 'medio' | 'alto';
  impactoEcologico: string;
  volumenEstimado: number; // en m³
  datosCompletos?: {
    area_km2?: number;
    volumen_km3?: number;
    clasificacion?: string;
    frente_termina_en?: string;
    altura_media_m?: number;
    altura_maxima_m?: number;
    altura_minima_m?: number;
    orientacion?: string;
    pendiente_grados?: number;
    latitud?: number;
    longitud?: number;
    region?: string;
    comuna?: string;
  };
}

export interface SimulacionResultado {
  volumenHieloPerdido: number; // en m³
  aguaGenerada: number; // en m³
  zonasAfectadas: any[]; // GeoJSON features
  tiempoSimulacion: number; // en segundos
  parametrosUsados: {
    temperatura: number;
    tiempoSimulacion: number;
    factorDeshielo: number;
  };
}

export interface DatosClimaticos {
  temperatura: Temperatura;
  humedad: number;
  precipitacion: number;
  viento: {
    velocidad: number;
    direccion: number;
  };
  ubicacion: {
    latitud: number;
    longitud: number;
    nombre: string;
  };
}

export interface GlaciarData {
  id: string;
  nombre: string;
  area: number;
  volumen: number;
  geometria: any; // GeoJSON geometry
  propiedades: any;
  latitud: number;
  longitud: number;
  tipo: string;
  altura_media?: number;
  altura_maxima?: number;
  altura_minima?: number;
  clasificacion?: string;
  region?: string;
  comuna?: string;
}

export interface AnalisisImpacto {
  impactoCultural: {
    nivel: 'bajo' | 'medio' | 'alto' | 'critico';
    descripcion: string;
    sitiosAfectados: string[];
    comunidadesIndigenas: string[];
    patrimonioAfectado: string[];
  };
  impactoAmbiental: {
    nivel: 'bajo' | 'medio' | 'alto' | 'critico';
    descripcion: string;
    ecosistemasAfectados: string[];
    especiesEnRiesgo: string[];
    habitatsFragmentados: string[];
    calidadAgua: string;
  };
  impactoUrbano: {
    nivel: 'bajo' | 'medio' | 'alto' | 'critico';
    descripcion: string;
    ciudadesCercanas: CiudadCercana[];
    poblacionAfectada: number;
    infraestructuraRiesgo: string[];
    recursosHidricosAfectados: string[];
  };
  recomendaciones: string[];
  nivelRiesgoGeneral: 'bajo' | 'medio' | 'alto' | 'critico';
}

export interface CiudadCercana {
  nombre: string;
  distancia: number; // en km
  poblacion: number;
  nivelRiesgo: 'bajo' | 'medio' | 'alto' | 'critico';
  tipoImpacto: string[];
}

export interface ImpactoGeologico {
  riesgoInundacion: 'bajo' | 'medio' | 'alto' | 'critico';
  estabilidadTerreno: 'estable' | 'moderado' | 'inestable' | 'muy_inestable';
  riesgoDeslizamiento: 'bajo' | 'medio' | 'alto' | 'critico';
  impactoRecursosHidricos: string[];
}

export interface ResultadoSimulacion {
  volumenPerdido: number;
  nuevoVolumen: number;
  temperaturaFinal: number;
  modificador: number;
  derretidoCompleto: boolean;
  factoresUsados: {
    ddf: number;
    diasDeshielo: number;
    factorClimatico: number;
  };
  analisisImpacto?: AnalisisImpacto;
}
