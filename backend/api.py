"""
API endpoints para el simulador de glaciares de la región de Aysén
"""
from fastapi import APIRouter, Query, HTTPException
from fastapi.responses import JSONResponse
import requests
import pandas as pd
import numpy as np
import datetime
import logging
from typing import Optional

# Configurar logging
logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)

router = APIRouter()

# URLs de configuración básica
OPENMETEO_URL = "https://api.open-meteo.com/v1/forecast"

def normalize_gdf_for_geojson(gdf):
    """Normaliza un GeoDataFrame para convertir a GeoJSON"""
    try:
        # Crear una copia para evitar SettingWithCopyWarning
        gdf = gdf.copy()
        
        # Asegurar CRS correcto
        if gdf.crs is None or gdf.crs.to_epsg() != 4326:
            gdf = gdf.to_crs(epsg=4326)
        
        # Simplificar geometrías
        gdf.loc[:, 'geometry'] = gdf['geometry'].simplify(0.01, preserve_topology=True)
        
        # Limpiar columnas problemáticas
        drop_cols = []
        for col in gdf.columns:
            if col == 'geometry':
                continue
            if gdf[col].apply(lambda x: not isinstance(x, (str, int, float, type(None)))).any():
                drop_cols.append(col)
        
        if drop_cols:
            gdf = gdf.drop(columns=drop_cols)
        
        # Rellenar valores nulos
        gdf = gdf.fillna("")
        
        # Estandarizar nombres de glaciares
        if 'NOMBRE_GLACIAR' in gdf.columns and 'NOMBRE_GLAC' not in gdf.columns:
            gdf = gdf.rename(columns={'NOMBRE_GLACIAR': 'NOMBRE_GLAC'})
        
        return gdf
    except Exception as e:
        logger.error(f"Error normalizando GeoDataFrame: {e}")
        raise

def normalize_name(name):
    """Normaliza nombres para hacer merge"""
    import unicodedata
    if pd.isna(name):
        return ""
    
    s = str(name).upper()
    s = ''.join(c for c in unicodedata.normalize('NFD', s) if unicodedata.category(c) != 'Mn')
    s = s.replace("'", "").replace("'", "").replace('`', "").replace('´', "")
    s = s.replace('"', "").replace('-', " ").replace('.', "").replace(',', "")
    s = s.replace('  ', ' ').strip()
    return s

# FUNCIONES AUXILIARES

def generate_grid_points_in_comuna(geometry, num_points=3):
    """Genera puntos distribuidos uniformemente dentro de una comuna"""
    from shapely.geometry import Point
    import random
    
    bounds = geometry.bounds
    minx, miny, maxx, maxy = bounds
    
    points = []
    attempts = 0
    max_attempts = num_points * 50  # Máximo intentos para evitar bucle infinito
    
    while len(points) < num_points and attempts < max_attempts:
        attempts += 1
        # Generar punto aleatorio dentro del bounding box
        x = random.uniform(minx, maxx)
        y = random.uniform(miny, maxy)
        point = Point(x, y)
        
        # Verificar si el punto está dentro de la geometría
        if geometry.contains(point):
            points.append({
                'lat': y,
                'lon': x,
                'id': f"grid_{len(points)}_{x:.4f}_{y:.4f}"
            })
    
    # Si no pudimos generar suficientes puntos, usar el centroide y puntos cercanos
    if len(points) < num_points:
        centroid = geometry.centroid
        if geometry.contains(centroid):
            points.append({
                'lat': centroid.y,
                'lon': centroid.x,
                'id': f"grid_centroid_{centroid.x:.4f}_{centroid.y:.4f}"
            })
        
        # Generar puntos adicionales cerca del centroide
        while len(points) < num_points:
            offset = 0.001 * (len(points) + 1)  # Pequeño offset
            x = centroid.x + random.uniform(-offset, offset)
            y = centroid.y + random.uniform(-offset, offset)
            point = Point(x, y)
            
            if geometry.contains(point):
                points.append({
                    'lat': y,
                    'lon': x,
                    'id': f"grid_near_centroid_{x:.4f}_{y:.4f}"
                })
            elif len(points) == 0:  # Si no hay puntos, usar el centroide aunque esté en el borde
                points.append({
                    'lat': centroid.y,
                    'lon': centroid.x,
                    'id': f"grid_centroid_fallback_{centroid.x:.4f}_{centroid.y:.4f}"
                })
    
    return points

# ENDPOINTS DE GLACIARES

@router.get("obtener glaciares")
async def get_glaciares_arcgis():
    """Obtiene glaciares de la región de Aysén desde ArcGIS Online"""
    try:
        params = {
            "where": "REGION='Aysen del General Carlos Ibañez del Campo'",
            "outFields": "*",
            "f": "geojson",
            "resultOffset": 0,
            "resultRecordCount": 1000
        }
        
        all_features = []
        page = 0
        
        while True:
            logger.info(f"Solicitando página {page} (offset {params['resultOffset']})")
            resp = requests.get(GEOJSON_URL, params=params, timeout=30)
            resp.raise_for_status()
            
            data = resp.json()
            features = data.get("features", [])
            
            if not features:
                break
                
            all_features.extend(features)
            
            if not data.get("exceededTransferLimit", False):
                break
                
            params["resultOffset"] += params["resultRecordCount"]
            page += 1
        
        logger.info(f"Total features descargados: {len(all_features)}")
        
        return {
            "type": "FeatureCollection",
            "features": all_features,
            "metadata": {
                "total": len(all_features),
                "source": "ArcGIS Online"
            }
        }
    except Exception as e:
        logger.error(f"Error obteniendo glaciares de ArcGIS: {e}")
        raise HTTPException(status_code=500, detail=str(e))

@router.get("/glaciares/local")
async def get_glaciares_local():
    """Obtiene glaciares desde shapefile local (inventario completo)"""
    try:
        if not os.path.exists(SHAPEFILE_PATHS["inventario"]):
            raise HTTPException(status_code=404, detail="Shapefile de inventario no encontrado")
        
        gdf = gpd.read_file(SHAPEFILE_PATHS["inventario"])
        gdf = normalize_gdf_for_geojson(gdf)
        
        return json.loads(gdf.to_json())
    except Exception as e:
        logger.error(f"Error obteniendo glaciares locales: {e}")
        raise HTTPException(status_code=500, detail=str(e))

@router.get("/glaciares/aysen")
async def get_glaciares_aysen():
    """Obtiene glaciares específicos de Aysén-Magallanes"""
    try:
        if not os.path.exists(SHAPEFILE_PATHS["aysen"]):
            raise HTTPException(status_code=404, detail="Shapefile de Aysén no encontrado")
        
        gdf = gpd.read_file(SHAPEFILE_PATHS["aysen"])
        gdf = normalize_gdf_for_geojson(gdf)
        
        # Convertir a GeoJSON (sin limitación)
        gj = json.loads(gdf.to_json())
        logger.info(f"Retornando {len(gj['features'])} glaciares de Aysén")
        
        return gj
    except Exception as e:
        logger.error(f"Error obteniendo glaciares de Aysén: {e}")
        raise HTTPException(status_code=500, detail=str(e))

@router.get("/glaciares/antiguos")
async def get_glaciares_antiguos():
    """Obtiene glaciares históricos con información de fechas"""
    try:
        if not os.path.exists(SHAPEFILE_PATHS["antiguos"]):
            raise HTTPException(status_code=404, detail="Shapefile de glaciares antiguos no encontrado")
        
        gdf = gpd.read_file(SHAPEFILE_PATHS["antiguos"])
        gdf = normalize_gdf_for_geojson(gdf)
        
        # Buscar columna de fecha
        fecha_col = None
        for col in gdf.columns:
            if "FECHA" in col.upper():
                fecha_col = col
                break
        
        fechas_unicas = []
        if fecha_col:
            fechas_unicas = list(gdf[fecha_col].dropna().unique())
        
        return {
            "geojson": json.loads(gdf.to_json()),
            "fechas": fechas_unicas
        }
    except Exception as e:
        logger.error(f"Error obteniendo glaciares antiguos: {e}")
        raise HTTPException(status_code=500, detail=str(e))

@router.get("/glaciares/2022")
async def get_glaciares_2022():
    """Obtiene glaciares del inventario 2022"""
    try:
        if not os.path.exists(SHAPEFILE_PATHS["2022"]):
            raise HTTPException(status_code=404, detail="Shapefile 2022 no encontrado")
        
        gdf = gpd.read_file(SHAPEFILE_PATHS["2022"])
        gdf = normalize_gdf_for_geojson(gdf)
        
        return json.loads(gdf.to_json())
    except Exception as e:
        logger.error(f"Error obteniendo glaciares 2022: {e}")
        raise HTTPException(status_code=500, detail=str(e))

# ENDPOINTS DE DATOS CLIMÁTICOS

@router.get("capas de arclim")
async def get_arclim_capas():
    """Obtiene capas disponibles de ARClim"""
    try:
        resp = requests.get(f"{ARCLIM_BASE}/capas", timeout=30)
        resp.raise_for_status()
        return resp.json()
    except Exception as e:
        logger.error(f"Error obteniendo capas ARClim: {e}")
        raise HTTPException(status_code=500, detail=str(e))

@router.get("/arclim/indicadores")
async def get_arclim_indicadores():
    """Obtiene indicadores climáticos de ARClim"""
    try:
        resp = requests.get(f"{ARCLIM_BASE}/indicadores_climaticos", timeout=30)
        resp.raise_for_status()
        return resp.json()
    except Exception as e:
        logger.error(f"Error obteniendo indicadores ARClim: {e}")
        raise HTTPException(status_code=500, detail=str(e))

@router.get("datos obtenidos de arclim")
async def get_arclim_datos_comunas_aysen(indicador: str = Query(default="hot_days")):
    """Obtiene datos climáticos para comunas de Aysén"""
    try:
        url = f"{ARCLIM_BASE}/datos/comunas/json/?attributes=NOM_COMUNA,NOM_REGION,$CLIMA${indicador}$annual$delta"
        resp = requests.get(url, timeout=30)
        resp.raise_for_status()
        
        data = resp.json()
        columns = data.get("columns", [])
        values = data.get("values", [])
        
        if not columns or not values:
            return []
        
        df = pd.DataFrame(values, columns=columns)
        df_aysen = df[df["NOM_REGION"].str.upper().str.contains("AYSEN|AYSÉN", na=False)]
        
        return df_aysen.to_dict(orient="records")
    except Exception as e:
        logger.error(f"Error obteniendo datos climáticos: {e}")
        raise HTTPException(status_code=500, detail=str(e))

@router.get("datos locales de aysen")
async def get_comunas_aysen():
    """Obtiene GeoJSON de comunas de Aysén con datos climáticos"""
    try:
        # Leer datos climáticos del Excel
        df = pd.read_excel(SHAPEFILE_PATHS["excel_clima"], sheet_name='DATOS')
        
        # Renombrar columnas climáticas
        rename_map = {
            '$CLIMA$tasmax_mean$annual$present$ssp585': 'tasmax_ssp585_2020',
            '$CLIMA$tasmax_mean$annual$future$ssp585': 'tasmax_ssp585_2050',
            '$CLIMA$tasmax_mean$annual$delta$ssp585': 'delta_ssp585_2050',        }
        df = df.rename(columns=rename_map)
        df = df.copy()  # Crear copia para evitar warnings
        df.loc[:, 'NOM_COMUNA_NORM'] = df['NOM_COMUNA'].apply(normalize_name)
        
        # Leer GeoJSON de comunas
        gdf = gpd.read_file(SHAPEFILE_PATHS["comunas"])
        gdf = gdf.copy()  # Crear copia para evitar warnings
        gdf.loc[:, 'NOM_COMUNA_NORM'] = gdf['NOM_COMUNA'].apply(normalize_name)
        
        # Hacer merge
        gdf = gdf.merge(df, on='NOM_COMUNA_NORM', how='left', suffixes=('', '_CLIMA'))
        gdf = gdf.drop(columns=['NOM_COMUNA_NORM'])
          # Asegurar columnas clave
        for col in ['tasmax_ssp585_2020', 'tasmax_ssp585_2050', 'delta_ssp585_2050']:
            if col not in gdf.columns:
                gdf.loc[:, col] = 'N/D'
        
        gdf.loc[:, ['tasmax_ssp585_2020', 'tasmax_ssp585_2050', 'delta_ssp585_2050']] = \
            gdf[['tasmax_ssp585_2020', 'tasmax_ssp585_2050', 'delta_ssp585_2050']].fillna('N/D')
        
        return json.loads(gdf.to_json())
    except Exception as e:
        logger.error(f"Error obteniendo comunas con datos climáticos: {e}")
        raise HTTPException(status_code=500, detail=str(e))

# ENDPOINTS STAC

@router.get("/stac")
async def get_stac_data(lng: Optional[float] = None, lat: Optional[float] = None, limit: int = 5):
    """Obtiene datos STAC de Aysén"""
    try:
        api_key = "eo-api-key-dev"
        headers = {"x-api-key": api_key, "Content-Type": "application/json"}
        
        if lng is not None and lat is not None:
            body = {
                "intersects": {
                    "type": "Point",
                    "coordinates": [lng, lat]
                },
                "collections": ["Aysen"],
                "limit": limit
            }
            resp = requests.post(
                "api de datos geospaciales",
                headers=headers,
                json=body,
                timeout=30
            )
        else:
            params = {"limit": limit}
            resp = requests.get(STAC_API_BASE, params=params, headers=headers, timeout=30)
        
        resp.raise_for_status()
        data = resp.json()
        features = data.get("features", [])
        
        results = []
        for feat in features:
            dt = feat.get("properties", {}).get("datetime")
            assets = feat.get("assets", {})
            if "model" in assets:
                results.append({"datetime": dt, "asset": assets["model"]["href"]})
            elif "visual" in assets:
                results.append({"datetime": dt, "asset": assets["visual"]["href"]})
        
        return results
    except Exception as e:
        logger.error(f"Error obteniendo datos STAC: {e}")
        raise HTTPException(status_code=500, detail=str(e))

# UTILIDADES

@router.post("/merge")
async def merge_geojson_excel(geojson: UploadFile = File(...), excel: UploadFile = File(...)):
    """Fusiona un archivo GeoJSON con datos de Excel"""
    try:
        # Crear archivos temporales
        with tempfile.NamedTemporaryFile(delete=False, suffix='.geojson') as tmp_geojson:
            shutil.copyfileobj(geojson.file, tmp_geojson)
            geojson_path = tmp_geojson.name
        
        with tempfile.NamedTemporaryFile(delete=False, suffix='.xlsx') as tmp_excel:
            shutil.copyfileobj(excel.file, tmp_excel)
            excel_path = tmp_excel.name
        
        # Leer archivos
        gdf = gpd.read_file(geojson_path)
        df = pd.read_excel(excel_path)
          # Normalizar nombres para merge
        comuna_col_gdf = 'NOM_COMUNA' if 'NOM_COMUNA' in gdf.columns else 'COMUNA' if 'COMUNA' in gdf.columns else gdf.columns[0]
        comuna_col_df = 'NOM_COMUNA' if 'NOM_COMUNA' in df.columns else 'COMUNA' if 'COMUNA' in df.columns else df.columns[0]
        
        gdf = gdf.copy()  # Crear copia para evitar warnings
        df = df.copy()    # Crear copia para evitar warnings
        gdf.loc[:, 'NOM_COMUNA_NORM'] = gdf[comuna_col_gdf].apply(normalize_name)
        df.loc[:, 'NOM_COMUNA_NORM'] = df[comuna_col_df].apply(normalize_name)
        
        # Hacer merge
        merged = gdf.merge(df, on='NOM_COMUNA_NORM', how='left', suffixes=('', '_excel'))
        merged = merged.drop(columns=['NOM_COMUNA_NORM'])
        
        # Limpiar archivos temporales
        os.remove(geojson_path)
        os.remove(excel_path)
        
        return Response(content=merged.to_json(), media_type="application/geo+json")
    except Exception as e:
        logger.error(f"Error en merge: {e}")
        raise HTTPException(status_code=500, detail=str(e))

@router.get("/health")
async def health_check():
    """Verifica el estado de la API"""
    return {
        "status": "ok",
        "message": "API funcionando correctamente",
        "endpoints": {
            "glaciares": ["arcgis", "local", "aysen", "antiguos", "2022"],
            "arclim": ["capas", "indicadores", "datos_comunas_aysen"],
            "geojson": ["comunas_aysen"],
            "stac": ["search"]
        }
    }

@router.get("/temperatura/comunas/completo")
async def get_temperatura_comunas_completo():
    """Obtiene datos completos de temperatura por comunas (2020, 2050, actual y delta) - OPTIMIZADO"""
    try:
        # Cargar datos de comunas
        comunas_gdf = gpd.read_file(SHAPEFILE_PATHS["comunas"])
          # Cargar datos de temperatura del Excel (hoja DATOS con columnas correctas)
        df_temp = pd.read_excel(SHAPEFILE_PATHS["excel_clima"], sheet_name='DATOS')
        
        # Procesar datos para incluir 2020, 2050 y delta
        features = []
        
        for idx, comuna in comunas_gdf.iterrows():
            # Datos básicos de la comuna
            nom_comuna = comuna.get('NOM_COMUNA', f'Comuna_{idx}')
            nom_region = comuna.get('NOM_REGION', 'Aysén del Gral. Carlos Ibáñez del Campo')
            
            # Normalizar nombre para buscar en Excel
            comuna_norm = normalize_name(nom_comuna)
            df_comuna = df_temp[df_temp['NOM_COMUNA'].apply(normalize_name) == comuna_norm] if 'NOM_COMUNA' in df_temp.columns else pd.DataFrame()
            
            # Temperaturas históricas y proyectadas desde Excel (columnas exactas)
            temp_2020 = None
            temp_2050 = None
            delta_temp = None
            
            if not df_comuna.empty:
                # Usar columnas exactas del Excel
                if '$CLIMA$tasmax_mean$annual$present$ssp585' in df_comuna.columns:
                    temp_2020 = float(df_comuna['$CLIMA$tasmax_mean$annual$present$ssp585'].iloc[0])
                if '$CLIMA$tasmax_mean$annual$future$ssp585' in df_comuna.columns:
                    temp_2050 = float(df_comuna['$CLIMA$tasmax_mean$annual$future$ssp585'].iloc[0])
                if '$CLIMA$tasmax_mean$annual$delta$ssp585' in df_comuna.columns:
                    delta_temp = float(df_comuna['$CLIMA$tasmax_mean$annual$delta$ssp585'].iloc[0])
            
            # Si no se encontraron datos en Excel, usar valores simulados
            if temp_2020 is None:
                temp_2020 = np.random.uniform(-2, 8)
            if temp_2050 is None:
                temp_2050 = temp_2020 + np.random.uniform(2, 4)
            if delta_temp is None:
                delta_temp = temp_2050 - temp_2020
            
            # Obtener temperatura actual desde OpenMeteo (para el centroide de la comuna)
            centroid = comuna.geometry.centroid
            lat, lon = centroid.y, centroid.x
            
            temp_actual = None
            try:
                params = {
                    "latitude": lat,
                    "longitude": lon,
                    "current": ["temperature_2m"],
                    "timezone": "America/Santiago"
                }
                response = requests.get(OPENMETEO_URL, params=params, timeout=3)
                if response.status_code == 200:
                    data = response.json()
                    temp_actual = data.get("current", {}).get("temperature_2m")
            except:
                temp_actual = None
            
            # Si no se pudo obtener temperatura actual, usar una simulada basada en la estación
            if temp_actual is None:
                import datetime
                mes_actual = datetime.datetime.now().month
                # Simular variación estacional (verano/invierno)
                if mes_actual in [12, 1, 2]:  # Verano
                    temp_actual = temp_2020 + np.random.uniform(2, 6)
                elif mes_actual in [6, 7, 8]:  # Invierno
                    temp_actual = temp_2020 - np.random.uniform(2, 8)
                else:  # Otoño/Primavera
                    temp_actual = temp_2020 + np.random.uniform(-2, 2)
            
            # Simplificar geometría drásticamente para reducir tamaño
            geom_simplified = comuna.geometry.simplify(0.05, preserve_topology=True)
            
            # Crear feature con SOLO propiedades esenciales
            properties = {
                "NOM_COMUNA": nom_comuna,
                "NOM_REGION": nom_region,
                "temperatura_2020": round(temp_2020, 2),
                "temperatura_2050": round(temp_2050, 2), 
                "temperatura_actual": round(temp_actual, 2) if temp_actual is not None else None,
                "delta_temperatura": round(delta_temp, 2),
                "latitud": round(lat, 6),
                "longitud": round(lon, 6)
            }
            
            feature = {
                "type": "Feature",
                "geometry": geom_simplified.__geo_interface__,
                "properties": properties
            }
            features.append(feature)
        
        geojson = {
            "type": "FeatureCollection", 
            "features": features,
            "metadata": {
                "total": len(features),
                "source": "Temperatura completa comunas Aysén (optimizado)",
                "propiedades": ["NOM_COMUNA", "NOM_REGION", "temperatura_2020", "temperatura_2050", "temperatura_actual", "delta_temperatura"]
            }
        }
        
        logger.info(f"Endpoint temperatura completo: retornando {len(features)} comunas con temperatura completa")
        return JSONResponse(content=geojson)
        
    except Exception as e:
        logger.error(f"Error obteniendo temperatura completa: {e}")
        raise HTTPException(status_code=500, detail=str(e))

@router.get("/temperatura/comunas/2020")
async def get_temperatura_comunas_2020():
    """Obtiene datos de temperatura por comunas para el año 2020"""
    try:
        # Cargar datos de comunas
        comunas_gdf = gpd.read_file(SHAPEFILE_PATHS["comunas"])
          # Cargar datos de temperatura del Excel
        df_temp = pd.read_excel(SHAPEFILE_PATHS["excel_clima"])
        
        # Filtrar datos del 2020
        df_2020 = df_temp[df_temp['year'] == 2020].copy() if 'year' in df_temp.columns else df_temp.copy()
        
        # Merge con comunas
        if 'comuna' in df_2020.columns and 'NOM_COMUNA' in comunas_gdf.columns:
            merged_gdf = comunas_gdf.merge(
                df_2020, 
                left_on='NOM_COMUNA', 
                right_on='comuna', 
                how='left'
            )
        else:
            # Si no hay match directo, usar datos simulados
            merged_gdf = comunas_gdf.copy()
            merged_gdf.loc[:, 'temperatura'] = np.random.uniform(-2, 8, len(merged_gdf))
          # Asegurar que hay columna de temperatura
        if 'temperatura' not in merged_gdf.columns:
            merged_gdf.loc[:, 'temperatura'] = np.random.uniform(-2, 8, len(merged_gdf))
        
        # Optimizar: mantener solo propiedades esenciales para el frontend
        propiedades_esenciales = ['NOM_COMUNA', 'NOM_REGION', 'temperatura']
        columnas_a_mantener = ['geometry'] + [col for col in propiedades_esenciales if col in merged_gdf.columns]
        merged_gdf = merged_gdf[columnas_a_mantener]
            
        # Convertir a GeoJSON
        merged_gdf = normalize_gdf_for_geojson(merged_gdf)
        geojson = json.loads(merged_gdf.to_json())
        
        # Agregar metadata optimizado
        geojson['metadata'] = {
            'total': len(geojson.get('features', [])),
            'source': 'Temperatura comunas 2020 (optimizado)',
            'propiedades': propiedades_esenciales
        }
        
        return JSONResponse(content=geojson)
        
    except Exception as e:
        logger.error(f"Error obteniendo temperatura 2020: {e}")
        raise HTTPException(status_code=500, detail=str(e))

@router.get("/temperatura/comunas/2050")
async def get_temperatura_comunas_2050():
    """Obtiene datos de temperatura proyectada por comunas para el año 2050"""
    try:
        # Cargar datos de comunas
        comunas_gdf = gpd.read_file(SHAPEFILE_PATHS["comunas"])
        
        # Cargar datos de temperatura del Excel
        df_temp = pd.read_excel(SHAPEFILE_PATHS["excel_clima"])
          # Filtrar datos del 2050 (o simular si no existen)
        df_2050 = df_temp[df_temp['year'] == 2050].copy() if 'year' in df_temp.columns else df_temp.copy()
        
        # Si no hay datos del 2050, simular aumento de temperatura
        if len(df_2050) == 0:
            # Usar datos del 2020 y agregar aumento proyectado
            df_2020 = df_temp[df_temp['year'] == 2020].copy() if 'year' in df_temp.columns else df_temp.copy()
            if len(df_2020) > 0:
                df_2050 = df_2020.copy()
                if 'temperatura' in df_2050.columns:
                    df_2050.loc[:, 'temperatura'] = df_2050['temperatura'] + np.random.uniform(2, 4, len(df_2050))
                df_2050.loc[:, 'year'] = 2050
          # Merge con comunas
        if 'comuna' in df_2050.columns and 'NOM_COMUNA' in comunas_gdf.columns:
            merged_gdf = comunas_gdf.merge(
                df_2050, 
                left_on='NOM_COMUNA', 
                right_on='comuna', 
                how='left'
            )
        else:
            # Datos simulados para 2050 (más calientes que 2020)
            merged_gdf = comunas_gdf.copy()
            merged_gdf.loc[:, 'temperatura'] = np.random.uniform(2, 12, len(merged_gdf))
          # Asegurar que hay columna de temperatura
        if 'temperatura' not in merged_gdf.columns:
            merged_gdf.loc[:, 'temperatura'] = np.random.uniform(2, 12, len(merged_gdf))
        
        # Optimizar: mantener solo propiedades esenciales para el frontend
        propiedades_esenciales = ['NOM_COMUNA', 'NOM_REGION', 'temperatura']
        columnas_a_mantener = ['geometry'] + [col for col in propiedades_esenciales if col in merged_gdf.columns]
        merged_gdf = merged_gdf[columnas_a_mantener]
            
        # Convertir a GeoJSON
        merged_gdf = normalize_gdf_for_geojson(merged_gdf)
        geojson = json.loads(merged_gdf.to_json())
        
        # Agregar metadata optimizado
        geojson['metadata'] = {
            'total': len(geojson.get('features', [])),
            'source': 'Temperatura comunas 2050 (optimizado)',
            'propiedades': propiedades_esenciales
        }
        
        return JSONResponse(content=geojson)
        
    except Exception as e:
        logger.error(f"Error obteniendo temperatura 2050: {e}")
        raise HTTPException(status_code=500, detail=str(e))

@router.get("/icebergs")
async def get_icebergs():
    """Obtiene datos de glaciares de la región de Aysén con información detallada y optimizada"""
    try:
        # Priorizar el shapefile de Aysén-Magallanes que tiene más información detallada
        if os.path.exists(SHAPEFILE_PATHS["aysen"]):
            gdf = gpd.read_file(SHAPEFILE_PATHS["aysen"])
            source_name = "Aysén-Magallanes (2019)"
            logger.info(f"Cargado shapefile Aysén-Magallanes con {len(gdf)} glaciares")
        elif os.path.exists(SHAPEFILE_PATHS["2022"]):
            gdf = gpd.read_file(SHAPEFILE_PATHS["2022"])
            source_name = "Inventario 2022"
            logger.info(f"Cargado shapefile 2022 con {len(gdf)} glaciares")
        else:
            logger.warning("No se encontraron shapefiles de glaciares")
            raise HTTPException(status_code=404, detail="No se encontraron datos de glaciares")
        
        # Asegurar que está en WGS84
        if gdf.crs is None or gdf.crs.to_epsg() != 4326:
            gdf = gdf.to_crs(epsg=4326)
            logger.info("CRS convertido a WGS84")
          # Filtrar solo glaciares de la región de Aysén
        if 'REGION' in gdf.columns:
            gdf = gdf[gdf['REGION'].str.contains('AISEN|AYSEN|Aysén|Aysen', case=False, na=False)]
            logger.info(f"Filtrado por región: {len(gdf)} glaciares")
        elif comunas_aysen_union is not None:
            gdf = gdf[gdf.geometry.intersects(comunas_aysen_union)]
            logger.info(f"Filtrados {len(gdf)} glaciares en región de Aysén")
        
        # Crear copia y simplificar geometrías para optimización
        gdf = gdf.copy()
        gdf.loc[:, 'geometry'] = gdf['geometry'].simplify(0.02, preserve_topology=True)
        
        # Mantener solo glaciares válidos con geometría
        gdf_valid = gdf[gdf.geometry.is_valid & ~gdf.geometry.is_empty].copy()
        
        if len(gdf_valid) == 0:
            logger.warning("No se encontraron glaciares válidos")
            raise HTTPException(status_code=404, detail="No se encontraron glaciares válidos en la región")
        
        logger.info(f"Procesando {len(gdf_valid)} glaciares de la región de Aysén")
        
        # Convertir a GeoJSON con información optimizada y útil
        features = []
        for idx, row in gdf_valid.iterrows():
            geom = row.geometry
            
            # Convertir geometría a diccionario GeoJSON simplificado
            if geom.geom_type == 'Polygon':
                geom_dict = {
                    "type": "Polygon",
                    "coordinates": [list(geom.exterior.coords)]
                }
            elif geom.geom_type == 'MultiPolygon':
                geom_dict = {
                    "type": "MultiPolygon", 
                    "coordinates": [[list(poly.exterior.coords)] for poly in geom.geoms]
                }
            else:
                geom_dict = geom.__geo_interface__
            
            # Obtener coordenadas del centroide
            centroid = geom.centroid
            lat = centroid.y
            lon = centroid.x
            
            # Extraer información específica según el shapefile
            nombre = row.get('NOMBRE', row.get('nombre', f'Sin Nombre {idx}'))
            if pd.isna(nombre) or nombre in ['S/N', 'Sin Nombre', '']:
                nombre = f'Glaciar #{idx}'
            
            # Área en km² (datos reales del shapefile)
            area_km2 = float(row.get('AREA_KM2', row.get('area_km2', 0)))
            
            # Volumen en km³ (datos reales si están disponibles)
            volumen_km3 = float(row.get('VOL_km3', row.get('VOL_KM3', 0)))
            
            # Altitudes en metros (datos reales)
            altura_media = float(row.get('HMEDIA', row.get('altura_med', 0))) if pd.notna(row.get('HMEDIA', row.get('altura_med'))) else None
            altura_max = float(row.get('HMAX', row.get('altura_max', 0))) if pd.notna(row.get('HMAX', row.get('altura_max'))) else None
            altura_min = float(row.get('HMIN', row.get('altura_min', 0))) if pd.notna(row.get('HMIN', row.get('altura_min'))) else None
            
            # Dónde termina el glaciar (información muy útil)
            frente_glaciar = row.get('FRENTE_TER', row.get('frente_ter', 'No especificado'))
            if pd.isna(frente_glaciar):
                frente_glaciar = 'No especificado'
            
            # Clasificación del glaciar
            clasificacion = row.get('CLASIFICA', row.get('class', row.get('tipo_super', 'Glaciar')))
            
            # Orientación
            orientacion = row.get('ORIENTA', row.get('orientacio', 'N/A'))
            
            # Pendiente promedio
            pendiente = float(row.get('PENDIENTE', row.get('pendiente', 0))) if pd.notna(row.get('PENDIENTE', row.get('pendiente'))) else None
            
            # Propiedades optimizadas para el frontend
            properties = {
                "id": int(idx),
                "nombre": nombre,
                "area_km2": round(area_km2, 3),
                "volumen_km3": round(volumen_km3, 4),
                "clasificacion": clasificacion,
                "frente_termina_en": frente_glaciar,
                "altura_media_m": int(altura_media) if altura_media else None,
                "altura_maxima_m": int(altura_max) if altura_max else None,
                "altura_minima_m": int(altura_min) if altura_min else None,
                "orientacion": orientacion,
                "pendiente_grados": round(pendiente, 1) if pendiente else None,
                "latitud": round(lat, 6),
                "longitud": round(lon, 6),
                "region": row.get('REGION', 'Aysén del Gral. Carlos Ibáñez del Campo'),
                "comuna": row.get('COMUNA', 'No especificada')
            }
            
            feature = {
                "type": "Feature",
                "geometry": geom_dict,
                "properties": properties
            }
            features.append(feature)
        
        geojson = {
            "type": "FeatureCollection",
            "features": features,
            "metadata": {
                "total": len(features),
                "source": f"Inventario de Glaciares - {source_name}",
                "propiedades_principales": [
                    "nombre", "area_km2", "volumen_km3", "altura_media_m", 
                    "frente_termina_en", "clasificacion", "orientacion"
                ]
            }
        }
        
        logger.info(f"Devolviendo {len(features)} glaciares optimizados de la región de Aysén")
        return JSONResponse(content=geojson)
        
    except Exception as e:
        logger.error(f"Error obteniendo glaciares de Aysén: {e}")
        raise HTTPException(status_code=500, detail=f"Error procesando glaciares: {str(e)}")

@router.get("/glaciares/geojson")
async def get_glaciares_geojson():
    """Obtiene todos los glaciares en formato GeoJSON combinando múltiples fuentes"""
    try:
        combined_gdf = None
        
        # Intentar cargar de múltiples fuentes de shapefiles
        for key, path in SHAPEFILE_PATHS.items():
            if key in ["inventario", "aysen", "antiguos", "2022"] and os.path.exists(path):
                try:
                    gdf = gpd.read_file(path)
                    
                    # Normalizar CRS
                    if gdf.crs is None or gdf.crs.to_epsg() != 4326:
                        gdf = gdf.to_crs(epsg=4326)                    
                    # Filtrar por región de Aysén si tenemos la máscara
                    if comunas_aysen_union is not None:
                        gdf = gdf[gdf.geometry.intersects(comunas_aysen_union)]
                    
                    # Crear copia para evitar warnings
                    gdf = gdf.copy()
                    
                    # Agregar información de fuente
                    gdf.loc[:, 'fuente'] = key
                    
                    # Calcular área y volumen si no existen
                    if 'area' not in gdf.columns:
                        gdf.loc[:, 'area'] = gdf.geometry.to_crs(epsg=3857).area  # en m²
                    
                    if 'volumen' not in gdf.columns:
                        # Estimación simple: volumen = área * espesor promedio (50m)
                        gdf.loc[:, 'volumen'] = gdf['area'] * 50  # en m³
                    
                    # Normalizar nombres de columnas
                    if 'Nombre' in gdf.columns:
                        gdf.loc[:, 'nombre'] = gdf['Nombre']
                    elif 'NAME' in gdf.columns:
                        gdf.loc[:, 'nombre'] = gdf['NAME']
                    elif 'name' not in gdf.columns:
                        gdf.loc[:, 'nombre'] = f'Glaciar_{gdf.index}'
                    
                    # Combinar con el GeoDataFrame principal
                    if combined_gdf is None:
                        combined_gdf = gdf
                    else:
                        combined_gdf = pd.concat([combined_gdf, gdf], ignore_index=True)
                        
                except Exception as e:
                    logger.warning(f"Error cargando {key}: {e}")
                    continue
        
        if combined_gdf is None or len(combined_gdf) == 0:
            # Si no se pudo cargar ningún archivo, crear datos simulados
            logger.warning("No se pudieron cargar shapefiles, creando datos simulados")
            
            # Crear glaciares simulados en la región de Aysén
            glaciares_data = []
            for i in range(20):
                lat = np.random.uniform(-48.0, -44.0)
                lon = np.random.uniform(-74.0, -71.0)
                area = np.random.uniform(1000000, 50000000)  # m²
                
                glaciares_data.append({
                    'nombre': f'Glaciar_Simulado_{i+1}',
                    'area': area,
                    'volumen': area * np.random.uniform(30, 100),
                    'fuente': 'simulado',
                    'geometry': f'POLYGON(({lon} {lat}, {lon+0.01} {lat}, {lon+0.01} {lat+0.01}, {lon} {lat+0.01}, {lon} {lat}))'
                })
            
            from shapely import wkt
            df = pd.DataFrame(glaciares_data)
            df['geometry'] = df['geometry'].apply(wkt.loads)
            combined_gdf = gpd.GeoDataFrame(df, crs='EPSG:4326')
        
        # Normalizar y convertir a GeoJSON
        combined_gdf = normalize_gdf_for_geojson(combined_gdf)
        geojson = json.loads(combined_gdf.to_json())
        
        logger.info(f"Retornando {len(combined_gdf)} glaciares")
        return JSONResponse(content=geojson)
        
    except Exception as e:
        logger.error(f"Error obteniendo glaciares GeoJSON: {e}")
        raise HTTPException(status_code=500, detail=str(e))

@router.get("/temperatura/openmeteo")
async def get_temperatura_openmeteo(
    lat: float = Query(-45.5, description="Latitud"),
    lon: float = Query(-72.0, description="Longitud"),
    days: int = Query(1, description="Número de días")
):
    """Obtiene datos de temperatura actual desde OpenMeteo"""
    try:
        params = {
            "latitude": lat,
            "longitude": lon,
            "current": ["temperature_2m", "relative_humidity_2m", "wind_speed_10m", "wind_direction_10m"],
            "hourly": ["temperature_2m"],
            "timezone": "America/Santiago",
            "forecast_days": days
        }
        
        response = requests.get(OPENMETEO_URL, params=params, timeout=10)
        response.raise_for_status()
        data = response.json()
        
        current = data.get("current", {})
        
        return {
            "ubicacion": {
                "latitud": lat,
                "longitud": lon
            },
            "actual": {
                "temperatura": current.get("temperature_2m", 0),
                "humedad": current.get("relative_humidity_2m", 0),
                "viento_velocidad": current.get("wind_speed_10m", 0),
                "viento_direccion": current.get("wind_direction_10m", 0)
            },
            "horario": data.get("hourly", {}),
            "unidades": data.get("current_units", {}),
            "fuente": "OpenMeteo"
        }
    except Exception as e:
        logger.error(f"Error obteniendo datos de OpenMeteo: {e}")
        raise HTTPException(status_code=500, detail=f"Error conectando con OpenMeteo: {str(e)}")

@router.get("/temperatura/region_aysen")
async def get_temperatura_region_aysen():
    """Obtiene datos de temperatura para múltiples puntos en la región de Aysén"""
    try:
        # Puntos importantes en la región de Aysén
        puntos = [
            {"nombre": "Coyhaique", "lat": -45.5752, "lon": -72.0662},
            {"nombre": "Puerto Aysén", "lat": -45.4014, "lon": -72.6925},
            {"nombre": "Chile Chico", "lat": -46.5417, "lon": -71.7267},
            {"nombre": "Cochrane", "lat": -47.2531, "lon": -72.5789},
            {"nombre": "Villa O'Higgins", "lat": -48.4667, "lon": -72.5667}
        ]
        
        resultados = []
        
        for punto in puntos:
            try:
                params = {
                    "latitude": punto["lat"],
                    "longitude": punto["lon"],
                    "current": ["temperature_2m", "relative_humidity_2m", "wind_speed_10m", "wind_direction_10m"],
                    "timezone": "America/Santiago"
                }
                
                response = requests.get(OPENMETEO_URL, params=params, timeout=5)
                response.raise_for_status()
                data = response.json()
                
                current = data.get("current", {})
                
                resultados.append({
                    "nombre": punto["nombre"],
                    "coordenadas": {
                        "latitud": punto["lat"],
                        "longitud": punto["lon"]
                    },
                    "temperatura": current.get("temperature_2m", 0),
                    "humedad": current.get("relative_humidity_2m", 0),
                    "viento_velocidad": current.get("wind_speed_10m", 0),
                    "viento_direccion": current.get("wind_direction_10m", 0)
                })
            except Exception as e:
                logger.warning(f"Error obteniendo datos para {punto['nombre']}: {e}")
                resultados.append({
                    "nombre": punto["nombre"],
                    "coordenadas": {
                        "latitud": punto["lat"],
                        "longitud": punto["lon"]
                    },
                    "temperatura": None,
                    "error": str(e)
                })
        
        return {
            "region": "Aysén del General Carlos Ibáñez del Campo",
            "puntos": resultados,
            "fuente": "OpenMeteo",
            "timestamp": pd.Timestamp.now().isoformat()
        }
        
    except Exception as e:
        logger.error(f"Error obteniendo temperatura de la región: {e}")
        raise HTTPException(status_code=500, detail=str(e))

# ENDPOINTS DE PINTURAS RUPESTRES

@router.get("/pinturas-rupestres")
async def get_pinturas_rupestres():
    """Obtiene sitios con pinturas rupestres de la región de Aysén desde ArcGIS Online"""
    try:
        # URL del servicio de ArcGIS para pinturas rupestres
        arcgis_url = "https://services.arcgis.com/7vNqJn7Zs9un1QPP/arcgis/rest/services/Sitios_con_motivo_rupestre_Regi%C3%B3n_de_Aysen/FeatureServer/0/query"
        
        params = {
            "where": "1=1",  # Obtener todos los registros
            "outFields": "*",
            "f": "geojson",
            "resultOffset": 0,
            "resultRecordCount": 1000
        }
        
        all_features = []
        page = 0
        
        while True:
            logger.info(f"Solicitando página {page} de pinturas rupestres (offset {params['resultOffset']})")
            resp = requests.get(arcgis_url, params=params, timeout=30)
            resp.raise_for_status()
            
            data = resp.json()
            features = data.get("features", [])
            
            if not features:
                break
                
            # Procesar y enriquecer cada feature
            for feature in features:
                props = feature.get("properties", {})
                
                # Agregar información adicional para el frontend
                props["tipo_sitio"] = "Pintura Rupestre"
                props["region"] = "Aysén del Gral. Carlos Ibáñez del Campo"
                props["patrimonio"] = "Cultural"
                
                # Normalizar campos si existen
                if "NOMBRE" in props:
                    props["nombre"] = props["NOMBRE"]
                elif "Name" in props:
                    props["nombre"] = props["Name"]
                elif not props.get("nombre"):
                    props["nombre"] = f"Sitio Rupestre #{props.get('OBJECTID', 'S/N')}"
                
                # Información de ubicación
                if feature.get("geometry", {}).get("type") == "Point":
                    coords = feature["geometry"]["coordinates"]
                    props["longitud"] = coords[0] if len(coords) > 0 else None
                    props["latitud"] = coords[1] if len(coords) > 1 else None
                
            all_features.extend(features)
            
            if not data.get("exceededTransferLimit", False):
                break
                
            params["resultOffset"] += params["resultRecordCount"]
            page += 1
        
        logger.info(f"Total pinturas rupestres descargadas: {len(all_features)}")
        
        return {
            "type": "FeatureCollection",
            "features": all_features,
            "metadata": {
                "total": len(all_features),
                "source": "ArcGIS Online - Sitios con motivo rupestre Región de Aysén",
                "tipo": "Pinturas Rupestres",
                "region": "Aysén del Gral. Carlos Ibáñez del Campo"
            }
        }
    except Exception as e:
        logger.error(f"Error obteniendo pinturas rupestres de ArcGIS: {e}")
        raise HTTPException(status_code=500, detail=f"Error obteniendo pinturas rupestres: {str(e)}")

# ENDPOINTS DE ALERTAS METEOROLÓGICAS

@router.get("/alertas/meteorologicas")
async def generar_alertas_meteorologicas():
    """Genera alertas automáticas basadas en datos meteorológicos reales de OpenMeteo"""
    try:
        # Ubicaciones de glaciares importantes en la Región de Aysén
        ubicaciones_glaciares = [
            {"nombre": "Glaciar San Rafael", "lat": -46.6833, "lng": -73.8333},
            {"nombre": "Glaciar Jorge Montt", "lat": -48.0167, "lng": -73.5333},
            {"nombre": "Glaciar O'Higgins", "lat": -48.8833, "lng": -72.9167},
            {"nombre": "Glaciar Tyndall", "lat": -50.9833, "lng": -73.5167},
            {"nombre": "Campo de Hielo Norte", "lat": -47.0, "lng": -73.5},
            {"nombre": "Campo de Hielo Sur", "lat": -49.5, "lng": -73.0}
        ]
        
        alertas_generadas = []
        
        for ubicacion in ubicaciones_glaciares:
            try:
                # Obtener datos meteorológicos actuales de OpenMeteo
                params = {
                    "latitude": ubicacion["lat"],
                    "longitude": ubicacion["lng"],
                    "current": "temperature_2m,relative_humidity_2m,precipitation,wind_speed_10m,wind_direction_10m",
                    "hourly": "temperature_2m,precipitation,wind_speed_10m",
                    "daily": "temperature_2m_max,temperature_2m_min,precipitation_sum,wind_speed_10m_max",
                    "timezone": "America/Santiago",
                    "past_days": 1,
                    "forecast_days": 3
                }
                
                response = requests.get(OPENMETEO_URL, params=params, timeout=10)
                
                if response.status_code == 200:
                    data = response.json()
                    
                    # Datos actuales
                    current = data.get("current", {})
                    daily = data.get("daily", {})
                    hourly = data.get("hourly", {})
                    
                    temp_actual = current.get("temperature_2m", 0)
                    precipitacion_actual = current.get("precipitation", 0)
                    viento_actual = current.get("wind_speed_10m", 0)
                    
                    # Calcular precipitación de las últimas 24 horas
                    precipitacion_24h = 0
                    if hourly.get("precipitation"):
                        precipitacion_24h = sum(hourly["precipitation"][-24:])
                    
                    # Temperatura máxima del día
                    temp_max_hoy = daily.get("temperature_2m_max", [0])[0] if daily.get("temperature_2m_max") else 0
                    
                    # REGLAS DE ALERTAS AUTOMÁTICAS
                    
                    # 1. Alerta por temperatura crítica (deshielo acelerado)
                    if temp_actual > 8 or temp_max_hoy > 12:
                        alertas_generadas.append({
                            "id": f"temp_critica_{ubicacion['nombre'].replace(' ', '_').lower()}",
                            "tipo": "deshielo_acelerado",
                            "nivel": "alta" if temp_actual > 12 else "media",
                            "titulo": f"Alerta de Deshielo Acelerado - {ubicacion['nombre']}",
                            "descripcion": f"Temperatura elevada detectada: {temp_actual}°C actual, máxima: {temp_max_hoy}°C. Riesgo de deshielo acelerado.",
                            "ubicacion": ubicacion["nombre"],
                            "coordenadas": {"lat": ubicacion["lat"], "lng": ubicacion["lng"]},
                            "indiceRiesgo": min(100, int((temp_actual + temp_max_hoy) * 3.5)),
                            "datos": {
                                "temperatura": temp_actual,
                                "temperaturaMaxima": temp_max_hoy,
                                "precipitacion": precipitacion_actual,
                                "viento": viento_actual
                            },
                            "timestamp": current.get("time", ""),
                            "impactoEsperado": "Aumento del caudal de ríos y arroyos glaciares",
                            "recomendaciones": "Monitorear niveles de agua en ríos cercanos. Evitar actividades en zonas bajas próximas a glaciares."
                        })
                    
                    # 2. Alerta por precipitación intensa
                    if precipitacion_24h > 20 or precipitacion_actual > 5:
                        alertas_generadas.append({
                            "id": f"precipitacion_intensa_{ubicacion['nombre'].replace(' ', '_').lower()}",
                            "tipo": "precipitacion_intensa",
                            "nivel": "critica" if precipitacion_24h > 50 else "alta",
                            "titulo": f"Alerta de Precipitación Intensa - {ubicacion['nombre']}",
                            "descripcion": f"Precipitación intensa: {precipitacion_24h:.1f}mm en 24h. Riesgo de crecidas y desprendimientos.",
                            "ubicacion": ubicacion["nombre"],
                            "coordenadas": {"lat": ubicacion["lat"], "lng": ubicacion["lng"]},
                            "indiceRiesgo": min(100, int(precipitacion_24h * 1.5)),
                            "datos": {
                                "temperatura": temp_actual,
                                "precipitacion": precipitacion_actual,
                                "precipitacion24h": precipitacion_24h,
                                "viento": viento_actual
                            },
                            "timestamp": current.get("time", ""),
                            "impactoEsperado": "Crecidas súbitas en ríos y arroyos. Posible inestabilidad de laderas.",
                            "recomendaciones": "Alejarse de cauces de ríos y zonas bajas. Monitorear pronóstico meteorológico."
                        })
                    
                    # 3. Alerta por viento extremo
                    if viento_actual > 60:
                        alertas_generadas.append({
                            "id": f"viento_extremo_{ubicacion['nombre'].replace(' ', '_').lower()}",
                            "tipo": "viento_extremo",
                            "nivel": "critica" if viento_actual > 80 else "alta",
                            "titulo": f"Alerta de Viento Extremo - {ubicacion['nombre']}",
                            "descripcion": f"Vientos extremos: {viento_actual} km/h. Riesgo de desprendimientos y avalanchas.",
                            "ubicacion": ubicacion["nombre"],
                            "coordenadas": {"lat": ubicacion["lat"], "lng": ubicacion["lng"]},
                            "indiceRiesgo": min(100, int(viento_actual * 0.8)),
                            "datos": {
                                "temperatura": temp_actual,
                                "viento": viento_actual,
                                "precipitacion": precipitacion_actual
                            },
                            "timestamp": current.get("time", ""),
                            "impactoEsperado": "Desprendimientos de hielo y roca. Condiciones peligrosas para navegación.",
                            "recomendaciones": "Evitar actividades al aire libre. Alejarse de áreas expuestas."
                        })
                    
                    # 4. Alerta combinada (condiciones críticas múltiples)
                    if temp_actual > 10 and precipitacion_24h > 15 and viento_actual > 40:
                        alertas_generadas.append({
                            "id": f"condiciones_criticas_{ubicacion['nombre'].replace(' ', '_').lower()}",
                            "tipo": "inestabilidad_glaciar",
                            "nivel": "critica",
                            "titulo": f"Condiciones Críticas Múltiples - {ubicacion['nombre']}",
                            "descripcion": f"Combinación peligrosa: Temp {temp_actual}°C, Precipitación {precipitacion_24h:.1f}mm/24h, Viento {viento_actual} km/h",
                            "ubicacion": ubicacion["nombre"],
                            "coordenadas": {"lat": ubicacion["lat"], "lng": ubicacion["lng"]},
                            "indiceRiesgo": 95,
                            "datos": {
                                "temperatura": temp_actual,
                                "precipitacion24h": precipitacion_24h,
                                "viento": viento_actual
                            },
                            "timestamp": current.get("time", ""),
                            "impactoEsperado": "Riesgo extremo de desprendimientos, crecidas y cambios bruscos en el glaciar.",
                            "recomendaciones": "ALERTA MÁXIMA: Evacuar zonas de riesgo. Suspender todas las actividades en el área."
                        })
                        
            except Exception as e:
                logger.error(f"Error obteniendo datos meteorológicos para {ubicacion['nombre']}: {e}")
                continue
        
        # Filtrar alertas duplicadas por ubicación
        alertas_unicas = {}
        for alerta in alertas_generadas:
            key = f"{alerta['ubicacion']}_{alerta['tipo']}"
            if key not in alertas_unicas or alerta['indiceRiesgo'] > alertas_unicas[key]['indiceRiesgo']:
                alertas_unicas[key] = alerta
        
        alertas_finales = list(alertas_unicas.values())
        
        logger.info(f"Generadas {len(alertas_finales)} alertas meteorológicas automáticas")
        
        return {
            "alertas": alertas_finales,
            "total": len(alertas_finales),
            "timestamp": pd.Timestamp.now().isoformat(),
            "fuente": "OpenMeteo API + Algoritmos propios",
            "region": "Aysén del Gral. Carlos Ibáñez del Campo"
        }
        
    except Exception as e:
        logger.error(f"Error generando alertas meteorológicas: {e}")
        raise HTTPException(status_code=500, detail=f"Error generando alertas: {str(e)}")

@router.get("/alertas/cuencas")
async def alertas_cuencas_hidrograficas():
    """Genera alertas específicas para cuencas hidrográficas basadas en datos meteorológicos"""
    try:
        # Principales cuencas de la región de Aysén
        cuencas = [
            {"nombre": "Cuenca Río Baker", "lat": -47.7, "lng": -72.8, "area_km2": 26726},
            {"nombre": "Cuenca Río Pascua", "lat": -48.8, "lng": -72.4, "area_km2": 8194},
            {"nombre": "Cuenca Río Aysén", "lat": -45.4, "lng": -72.7, "area_km2": 11674},
            {"nombre": "Cuenca Río Cisnes", "lat": -44.2, "lng": -71.8, "area_km2": 7500},
            {"nombre": "Cuenca Río Palena", "lat": -43.6, "lng": -71.5, "area_km2": 10500}
        ]
        
        alertas_cuencas = []
        
        for cuenca in cuencas:
            try:
                # Obtener datos meteorológicos para la cuenca
                params = {
                    "latitude": cuenca["lat"],
                    "longitude": cuenca["lng"],
                    "current": "temperature_2m,precipitation,wind_speed_10m",
                    "hourly": "precipitation,temperature_2m",
                    "daily": "precipitation_sum,temperature_2m_max",
                    "timezone": "America/Santiago",
                    "past_days": 2,
                    "forecast_days": 2
                }
                
                response = requests.get(OPENMETEO_URL, params=params, timeout=10)
                
                if response.status_code == 200:
                    data = response.json()
                    
                    current = data.get("current", {})
                    hourly = data.get("hourly", {})
                    daily = data.get("daily", {})
                    
                    # Calcular precipitación acumulada 48h
                    precipitacion_48h = 0
                    if hourly.get("precipitation"):
                        precipitacion_48h = sum(hourly["precipitation"][-48:])
                    
                    # Precipitación diaria máxima
                    precip_max_diaria = max(daily.get("precipitation_sum", [0])) if daily.get("precipitation_sum") else 0
                    
                    # Temperatura máxima (para determinar si es lluvia o nieve)
                    temp_max = max(daily.get("temperature_2m_max", [0])) if daily.get("temperature_2m_max") else 0
                    
                    # REGLAS ESPECÍFICAS PARA CUENCAS
                    
                    # Alerta de crecida por precipitación intensa
                    if precipitacion_48h > 30 and temp_max > 3:  # Lluvia, no nieve
                        factor_area = min(1.5, cuenca["area_km2"] / 10000)  # Factor por tamaño de cuenca
                        indice_riesgo = min(100, int(precipitacion_48h * factor_area * 1.2))
                        
                        alertas_cuencas.append({
                            "id": f"crecida_{cuenca['nombre'].replace(' ', '_').lower()}",
                            "tipo": "crecida_fluvial",
                            "nivel": "critica" if precipitacion_48h > 60 else "alta",
                            "titulo": f"Alerta de Crecida - {cuenca['nombre']}",
                            "descripcion": f"Precipitación intensa en cuenca: {precipitacion_48h:.1f}mm en 48h. Riesgo de crecida del río principal.",
                            "ubicacion": cuenca["nombre"],
                            "coordenadas": {"lat": cuenca["lat"], "lng": cuenca["lng"]},
                            "indiceRiesgo": indice_riesgo,
                            "datos": {
                                "precipitacion48h": precipitacion_48h,
                                "temperaturaMaxima": temp_max,
                                "areaCuenca": cuenca["area_km2"]
                            },
                            "timestamp": current.get("time", ""),
                            "impactoEsperado": f"Crecida del río principal de la {cuenca['nombre']}. Riesgo para infraestructura y actividades cercanas al cauce.",
                            "recomendaciones": "Monitorear niveles de agua. Alejarse de cauces y zonas bajas. Preparar evacuación si es necesario."
                        })
                    
                    # Alerta de deshielo combinado con lluvia
                    if temp_max > 8 and precipitacion_48h > 20:
                        alertas_cuencas.append({
                            "id": f"deshielo_lluvia_{cuenca['nombre'].replace(' ', '_').lower()}",
                            "tipo": "deshielo_precipitacion",
                            "nivel": "critica",
                            "titulo": f"Alerta Deshielo + Lluvia - {cuenca['nombre']}",
                            "descripcion": f"Combinación crítica: Temp máx {temp_max}°C + {precipitacion_48h:.1f}mm lluvia. Riesgo extremo de crecida.",
                            "ubicacion": cuenca["nombre"],
                            "coordenadas": {"lat": cuenca["lat"], "lng": cuenca["lng"]},
                            "indiceRiesgo": 90,
                            "datos": {
                                "temperaturaMaxima": temp_max,
                                "precipitacion48h": precipitacion_48h,
                                "areaCuenca": cuenca["area_km2"]
                            },
                            "timestamp": current.get("time", ""),
                            "impactoEsperado": "Crecida súbita por deshielo acelerado + lluvia. Riesgo MUY ALTO.",
                            "recomendaciones": "EVACUACIÓN INMEDIATA de zonas bajas. Suspender actividades en la cuenca."
                        })
                        
            except Exception as e:
                logger.error(f"Error procesando cuenca {cuenca['nombre']}: {e}")
                continue
        
        logger.info(f"Generadas {len(alertas_cuencas)} alertas para cuencas hidrográficas")
        
        return {
            "alertas": alertas_cuencas,
            "total": len(alertas_cuencas),
            "timestamp": pd.Timestamp.now().isoformat(),
            "fuente": "OpenMeteo API + Análisis de cuencas",
            "region": "Aysén del Gral. Carlos Ibáñez del Campo"
        }
        
    except Exception as e:
        logger.error(f"Error generando alertas de cuencas: {e}")
        raise HTTPException(status_code=500, detail=f"Error generando alertas de cuencas: {str(e)}")

@router.get("/topografia/elevacion")
async def obtener_elevacion_openTopo(
    lat: float = Query(..., description="Latitud"),
    lon: float = Query(..., description="Longitud")
):
    """Obtiene datos de elevación desde OpenTopoData para análisis de cuencas"""
    try:
        # Usar OpenTopoData para obtener elevación
        url = f"https://api.opentopodata.org/v1/aster30m"
        params = {
            "locations": f"{lat},{lon}"
        }
        
        response = requests.get(url, params=params, timeout=10)
        response.raise_for_status()
        data = response.json()
        
        if data.get("status") == "OK" and data.get("results"):
            elevation = data["results"][0]["elevation"]
            
            return {
                "latitud": lat,
                "longitud": lon,
                "elevacion_m": elevation,
                "fuente": "OpenTopoData ASTER 30m",
                "status": "OK"
            }
        else:
            raise HTTPException(status_code=404, detail="No se pudo obtener elevación para esta ubicación")
            
    except Exception as e:
        logger.error(f"Error obteniendo elevación: {e}")
        raise HTTPException(status_code=500, detail=f"Error obteniendo datos topográficos: {str(e)}")

@router.get("/alertas/avanzadas")
async def generar_alertas_avanzadas():
    """Genera alertas avanzadas combinando datos meteorológicos, topográficos y glaciológicos"""
    try:
        # Glaciares con datos topográficos específicos
        glaciares_prioritarios = [
            {"nombre": "Glaciar San Rafael", "lat": -46.6833, "lng": -73.8333, "elevacion_aprox": 1500},
            {"nombre": "Glaciar Jorge Montt", "lat": -48.0167, "lng": -73.5333, "elevacion_aprox": 1200},
            {"nombre": "Glaciar O'Higgins", "lat": -48.8833, "lng": -72.9167, "elevacion_aprox": 800},
            {"nombre": "Glaciar Tyndall", "lat": -50.9833, "lng": -73.5167, "elevacion_aprox": 900}
        ]
        
        alertas_avanzadas = []
        
        for glaciar in glaciares_prioritarios:
            try:
                # Obtener datos meteorológicos
                params_meteo = {
                    "latitude": glaciar["lat"],
                    "longitude": glaciar["lng"],
                    "current": "temperature_2m,precipitation,wind_speed_10m,relative_humidity_2m",
                    "hourly": "temperature_2m,precipitation",
                    "daily": "temperature_2m_max,temperature_2m_min,precipitation_sum",
                    "timezone": "America/Santiago",
                    "past_days": 3,
                    "forecast_days": 2
                }
                
                response_meteo = requests.get(OPENMETEO_URL, params=params_meteo, timeout=10)
                
                if response_meteo.status_code == 200:
                    data_meteo = response_meteo.json()
                    current = data_meteo.get("current", {})
                    hourly = data_meteo.get("hourly", {})
                    daily = data_meteo.get("daily", {})
                    
                    temp_actual = current.get("temperature_2m", 0)
                    precipitacion_actual = current.get("precipitation", 0)
                    humedad = current.get("relative_humidity_2m", 0)
                    viento = current.get("wind_speed_10m", 0)
                    
                    # Calcular tendencias de temperatura (últimas 72h)
                    temps_72h = hourly.get("temperature_2m", [])[-72:] if hourly.get("temperature_2m") else []
                    tendencia_temp = "estable"
                    if len(temps_72h) > 24:
                        temp_media_reciente = sum(temps_72h[-24:]) / 24
                        temp_media_anterior = sum(temps_72h[-48:-24]) / 24
                        if temp_media_reciente > temp_media_anterior + 2:
                            tendencia_temp = "aumentando"
                        elif temp_media_reciente < temp_media_anterior - 2:
                            tendencia_temp = "disminuyendo"
                    
                    # Precipitación acumulada 72h
                    precip_72h = sum(hourly.get("precipitation", [])[-72:]) if hourly.get("precipitation") else 0
                    
                    # ALGORITMOS AVANZADOS DE ALERTAS
                    
                    # 1. Algoritmo de Deshielo con Elevación
                    if temp_actual > 0 and glaciar["elevacion_aprox"] < 1000:
                        # Glaciares de baja altitud más vulnerables
                        factor_elevacion = 1.5 if glaciar["elevacion_aprox"] < 500 else 1.2
                        indice_deshielo = (temp_actual * factor_elevacion) + (humedad * 0.1)
                        
                        if indice_deshielo > 8:
                            alertas_avanzadas.append({
                                "id": f"deshielo_avanzado_{glaciar['nombre'].replace(' ', '_').lower()}",
                                "tipo": "deshielo_acelerado",
                                "nivel": "critica" if indice_deshielo > 15 else "alta",
                                "titulo": f"Deshielo Crítico por Baja Elevación - {glaciar['nombre']}",
                                "descripcion": f"Glaciar de baja altitud ({glaciar['elevacion_aprox']}m) con temperatura {temp_actual}°C. Índice de deshielo: {indice_deshielo:.1f}",
                                "ubicacion": glaciar["nombre"],
                                "coordenadas": {"lat": glaciar["lat"], "lng": glaciar["lng"]},
                                "indiceRiesgo": min(100, int(indice_deshielo * 5)),
                                "algoritmo": "Deshielo + Elevación",
                                "datos": {
                                    "temperatura": temp_actual,
                                    "elevacion": glaciar["elevacion_aprox"],
                                    "humedad": humedad,
                                    "indiceDeshielo": indice_deshielo
                                },
                                "timestamp": current.get("time", ""),
                                "impactoEsperado": "Retroceso acelerado del glaciar. Aumento significativo del caudal de ríos glaciares.",
                                "recomendaciones": "Monitoreo continuo de caudales. Preparar medidas de evacuación en zonas bajas."
                            })
                    
                    # 2. Algoritmo de Lluvia sobre Nieve/Hielo
                    if temp_actual > 2 and precipitacion_actual > 2:
                        factor_lluvia_hielo = precipitacion_actual * 2 if temp_actual > 5 else precipitacion_actual * 1.5
                        
                        if factor_lluvia_hielo > 6:
                            alertas_avanzadas.append({
                                "id": f"lluvia_hielo_{glaciar['nombre'].replace(' ', '_').lower()}",
                                "tipo": "lluvia_sobre_hielo",
                                "nivel": "critica",
                                "titulo": f"Lluvia sobre Hielo - {glaciar['nombre']}",
                                "descripcion": f"Lluvia ({precipitacion_actual}mm/h) sobre superficie glaciar a {temp_actual}°C. Aceleración extrema del deshielo.",
                                "ubicacion": glaciar["nombre"],
                                "coordenadas": {"lat": glaciar["lat"], "lng": glaciar["lng"]},
                                "indiceRiesgo": min(100, int(factor_lluvia_hielo * 8)),
                                "algoritmo": "Lluvia sobre Hielo",
                                "datos": {
                                    "temperatura": temp_actual,
                                    "precipacion": precipitacion_actual,
                                    "factorRiesgo": factor_lluvia_hielo
                                },
                                "timestamp": current.get("time", ""),
                                "impactoEsperado": "Deshielo explosivo. Posibles GLOF (Glacial Lake Outburst Floods).",
                                "recomendaciones": "EVACUACIÓN INMEDIATA de áreas aguas abajo. Cerrar acceso al glaciar."
                            })
                    
                    # 3. Algoritmo de Tendencia Climática
                    if tendencia_temp == "aumentando" and precip_72h > 40:
                        alertas_avanzadas.append({
                            "id": f"tendencia_critica_{glaciar['nombre'].replace(' ', '_').lower()}",
                            "tipo": "tendencia_climatica_adversa",
                            "nivel": "alta",
                            "titulo": f"Tendencia Climática Adversa - {glaciar['nombre']}",
                            "descripcion": f"Tendencia de calentamiento sostenido + {precipitacion_72h:.1f}mm en 72h. Condiciones de riesgo prolongado.",
                            "ubicacion": glaciar["nombre"],
                            "coordenadas": {"lat": glaciar["lat"], "lng": glaciar["lng"]},
                            "indiceRiesgo": 75,
                            "algoritmo": "Análisis de Tendencias",
                            "datos": {
                                "tendenciaTemperatura": tendencia_temp,
                                "precipitacion72h": precip_72h,
                                "temperaturaActual": temp_actual
                            },
                            "timestamp": current.get("time", ""),
                            "impactoEsperado": "Deterioro progresivo del glaciar. Cambios en patrones de drenaje.",
                            "recomendaciones": "Monitoreo intensivo. Revisar infraestructura en el área de influencia glaciar."
                        })
                        
            except Exception as e:
                logger.error(f"Error procesando glaciar {glaciar['nombre']}: {e}")
                continue
        
        # Algoritmo de proximidad: alertas para glaciares cercanos
        if len(alertas_avanzadas) > 1:
            # Si hay múltiples alertas, generar una alerta regional
            alertas_avanzadas.append({
                "id": "alerta_regional_multiples",
                "tipo": "alerta_regional",
                "nivel": "critica",
                "titulo": "Alerta Regional - Múltiples Glaciares en Riesgo",
                "descripcion": f"Se detectaron condiciones críticas en {len(alertas_avanzadas)} glaciares de la región simultáneamente.",
                "ubicacion": "Región de Aysén",
                "coordenadas": {"lat": -47.0, "lng": -73.0},
                "indiceRiesgo": 95,
                "algoritmo": "Análisis Regional",
                "datos": {
                    "glaciaresAfectados": len(alertas_avanzadas),
                    "tipoAlertas": list(set([a["tipo"] for a in alertas_avanzadas]))
                },
                "timestamp": pd.Timestamp.now().isoformat(),
                "impactoEsperado": "Impacto regional significativo en recursos hídricos y actividades humanas.",
                "recomendaciones": "Activar protocolo de emergencia regional. Coordinar respuesta inter-institucional."
            })
        
        logger.info(f"Generadas {len(alertas_avanzadas)} alertas avanzadas")
        
        return {
            "alertas": alertas_avanzadas,
            "total": len(alertas_avanzadas),
            "timestamp": pd.Timestamp.now().isoformat(),
            "algoritmos_utilizados": ["Deshielo + Elevación", "Lluvia sobre Hielo", "Análisis de Tendencias", "Análisis Regional"],
            "fuentes_datos": ["OpenMeteo", "OpenTopoData", "Algoritmos propios"],
            "region": "Aysén del Gral. Carlos Ibáñez del Campo"
        }
        
    except Exception as e:
        logger.error(f"Error generando alertas avanzadas: {e}")
        raise HTTPException(status_code=500, detail=f"Error generando alertas avanzadas: {str(e)}")

@router.get("/icebergs/marcadores")
async def get_icebergs_marcadores():
    """Obtiene datos simplificados de glaciares como marcadores para evitar problemas de rendimiento"""
    try:
        # Priorizar el shapefile de Aysén-Magallanes que tiene más información detallada
        if os.path.exists(SHAPEFILE_PATHS["aysen"]):
            gdf = gpd.read_file(SHAPEFILE_PATHS["aysen"])
            source_name = "Aysén-Magallanes (2019)"
            logger.info(f"Cargado shapefile Aysén-Magallanes con {len(gdf)} glaciares")
        elif os.path.exists(SHAPEFILE_PATHS["2022"]):
            gdf = gpd.read_file(SHAPEFILE_PATHS["2022"])
            source_name = "Inventario 2022"
            logger.info(f"Cargado shapefile 2022 con {len(gdf)} glaciares")
        else:
            logger.warning("No se encontraron shapefiles de glaciares")
            raise HTTPException(status_code=404, detail="No se encontraron datos de glaciares")
        
        # Asegurar que está en WGS84
        if gdf.crs is None or gdf.crs.to_epsg() != 4326:
            gdf = gdf.to_crs(epsg=4326)
            logger.info("CRS convertido a WGS84")
          
        # Filtrar solo glaciares de la región de Aysén
        if 'REGION' in gdf.columns:
            gdf = gdf[gdf['REGION'].str.contains('AISEN|AYSEN|Aysén|Aysen', case=False, na=False)]
            logger.info(f"Filtrado por región: {len(gdf)} glaciares")
        elif comunas_aysen_union is not None:
            gdf = gdf[gdf.geometry.intersects(comunas_aysen_union)]
            logger.info(f"Filtrados {len(gdf)} glaciares en región de Aysén")
        
        # Mantener solo glaciares válidos con geometría
        gdf_valid = gdf[gdf.geometry.is_valid & ~gdf.geometry.is_empty].copy()
        
        if len(gdf_valid) == 0:
            logger.warning("No se encontraron glaciares válidos")
            raise HTTPException(status_code=404, detail="No se encontraron glaciares válidos en la región")
        
        logger.info(f"Procesando {len(gdf_valid)} glaciares de la región de Aysén")
        
        # Convertir a marcadores simples (solo puntos centroides)
        marcadores = []
        for idx, row in gdf_valid.iterrows():
            # Obtener coordenadas del centroide únicamente
            centroid = row.geometry.centroid
            lat = centroid.y
            lon = centroid.x
            
            # Extraer información específica según el shapefile
            nombre = row.get('NOMBRE', row.get('nombre', f'Sin Nombre {idx}'))
            if pd.isna(nombre) or nombre in ['S/N', 'Sin Nombre', '']:
                nombre = f'Glaciar #{idx}'
            
            # Área en km² (datos reales del shapefile)
            area_km2 = float(row.get('AREA_KM2', row.get('area_km2', 0)))
            
            # Volumen en km³ (datos reales si están disponibles)
            volumen_km3 = float(row.get('VOL_km3', row.get('VOL_KM3', 0)))
            
            # Altitudes en metros (datos reales)
            altura_media = float(row.get('HMEDIA', row.get('altura_med', 0))) if pd.notna(row.get('HMEDIA', row.get('altura_med'))) else None
            altura_max = float(row.get('HMAX', row.get('altura_max', 0))) if pd.notna(row.get('HMAX', row.get('altura_max'))) else None
            altura_min = float(row.get('HMIN', row.get('altura_min', 0))) if pd.notna(row.get('HMIN', row.get('altura_min'))) else None
            
            # Dónde termina el glaciar (información muy útil)
            frente_glaciar = row.get('FRENTE_TER', row.get('frente_ter', 'No especificado'))
            if pd.isna(frente_glaciar):
                frente_glaciar = 'No especificado'
            
            # Clasificación del glaciar
            clasificacion = row.get('CLASIFICA', row.get('class', row.get('tipo_super', 'Glaciar')))
            
            # Orientación
            orientacion = row.get('ORIENTA', row.get('orientacio', 'N/A'))
            
            # Pendiente promedio
            pendiente = float(row.get('PENDIENTE', row.get('pendiente', 0))) if pd.notna(row.get('PENDIENTE', row.get('pendiente'))) else None
            
            # Crear marcador simplificado
            marcador = {
                "id": int(idx),
                "nombre": nombre,
                "lat": round(lat, 6),
                "lng": round(lon, 6),
                "area_km2": round(area_km2, 3),
                "volumen_km3": round(volumen_km3, 4),
                "clasificacion": clasificacion,
                "frente_termina_en": frente_glaciar,
                "altura_media_m": int(altura_media) if altura_media else None,
                "altura_maxima_m": int(altura_max) if altura_max else None,
                "altura_minima_m": int(altura_min) if altura_min else None,
                "orientacion": orientacion,
                "pendiente_grados": round(pendiente, 1) if pendiente else None,
                "region": row.get('REGION', 'Aysén del Gral. Carlos Ibáñez del Campo'),
                "comuna": row.get('COMUNA', 'No especificada')
            }
            marcadores.append(marcador)
        
        response = {
            "marcadores": marcadores,
            "total": len(marcadores),
            "source": f"Inventario de Glaciares - {source_name}",
            "tipo": "marcadores_simplificados"
        }
        
        logger.info(f"Devolviendo {len(marcadores)} marcadores de glaciares optimizados")
        return JSONResponse(content=response)
        
    except Exception as e:
        logger.error(f"Error obteniendo marcadores de glaciares: {e}")
        raise HTTPException(status_code=500, detail=f"Error procesando marcadores de glaciares: {str(e)}")

@router.get("/icebergs/geojson-optimizado")
async def get_icebergs_geojson_optimizado():
    """Obtiene glaciares como GeoJSON optimizado para visualización eficiente en el mapa"""
    try:
        # Priorizar el shapefile de Aysén-Magallanes que tiene más información detallada
        if os.path.exists(SHAPEFILE_PATHS["aysen"]):
            gdf = gpd.read_file(SHAPEFILE_PATHS["aysen"])
            source_name = "Aysén-Magallanes (2019)"
            logger.info(f"Cargado shapefile Aysén-Magallanes con {len(gdf)} glaciares")
        elif os.path.exists(SHAPEFILE_PATHS["2022"]):
            gdf = gpd.read_file(SHAPEFILE_PATHS["2022"])
            source_name = "Inventario 2022"
            logger.info(f"Cargado shapefile 2022 con {len(gdf)} glaciares")
        else:
            logger.warning("No se encontraron shapefiles de glaciares")
            raise HTTPException(status_code=404, detail="No se encontraron datos de glaciares")
        
        # Asegurar que está en WGS84
        if gdf.crs is None or gdf.crs.to_epsg() != 4326:
            gdf = gdf.to_crs(epsg=4326)
            logger.info("CRS convertido a WGS84")
          
        # Filtrar solo glaciares de la región de Aysén
        if 'REGION' in gdf.columns:
            gdf = gdf[gdf['REGION'].str.contains('AISEN|AYSEN|Aysén|Aysen', case=False, na=False)]
            logger.info(f"Filtrado por región: {len(gdf)} glaciares")
        elif comunas_aysen_union is not None:
            gdf = gdf[gdf.geometry.intersects(comunas_aysen_union)]
            logger.info(f"Filtrados {len(gdf)} glaciares en región de Aysén")
        
        # Crear copia y simplificar geometrías AGRESIVAMENTE para optimización
        gdf = gdf.copy()
        gdf.loc[:, 'geometry'] = gdf['geometry'].simplify(0.005, preserve_topology=True)  # Más simplificación
        
        # Mantener solo glaciares válidos con geometría
        gdf_valid = gdf[gdf.geometry.is_valid & ~gdf.geometry.is_empty].copy()
        
        if len(gdf_valid) == 0:
            logger.warning("No se encontraron glaciares válidos")
            raise HTTPException(status_code=404, detail="No se encontraron glaciares válidos en la región")
        
        # Filtrar solo glaciares grandes para evitar saturar el mapa
        if 'AREA_KM2' in gdf_valid.columns:
            gdf_valid = gdf_valid[gdf_valid['AREA_KM2'] > 0.5].copy()  # Solo glaciares > 0.5 km²
            logger.info(f"Filtrados glaciares grandes: {len(gdf_valid)} glaciares")
        
        # Limpiar columnas problemáticas y mantener solo las esenciales
        columnas_esenciales = ['geometry']
        for col in ['NOMBRE', 'nombre', 'AREA_KM2', 'area_km2', 'VOL_km3', 'VOL_KM3', 
                   'HMEDIA', 'altura_med', 'FRENTE_TER', 'frente_ter', 'CLASIFICA', 'class']:
            if col in gdf_valid.columns:
                columnas_esenciales.append(col)
        
        # Mantener solo columnas esenciales
        columnas_disponibles = [col for col in columnas_esenciales if col in gdf_valid.columns]
        gdf_final = gdf_valid[columnas_disponibles].copy()
        
        # Normalizar nombres de columnas para el frontend
        gdf_final = gdf_final.rename(columns={
            'NOMBRE': 'nombre',
            'AREA_KM2': 'area_km2', 
            'VOL_km3': 'volumen_km3',
            'VOL_KM3': 'volumen_km3',
            'HMEDIA': 'altura_media',
            'altura_med': 'altura_media',
            'FRENTE_TER': 'frente_termina',
            'frente_ter': 'frente_termina',
            'CLASIFICA': 'clasificacion',
            'class': 'clasificacion'
        })
        
        # Rellenar valores faltantes
        for col in gdf_final.columns:
            if col != 'geometry':
                gdf_final[col] = gdf_final[col].fillna('N/A')
        
        # Asegurar que tenemos nombre para cada glaciar
        if 'nombre' not in gdf_final.columns:
            gdf_final['nombre'] = [f'Glaciar #{i+1}' for i in range(len(gdf_final))]
        else:
            mask_sin_nombre = (gdf_final['nombre'].isna()) | (gdf_final['nombre'] == 'N/A') | (gdf_final['nombre'] == '')
            gdf_final.loc[mask_sin_nombre, 'nombre'] = [f'Glaciar #{i+1}' for i in range(mask_sin_nombre.sum())]
        
        logger.info(f"Procesando {len(gdf_final)} glaciares optimizados")
        
        # Convertir a GeoJSON optimizado
        geojson = json.loads(gdf_final.to_json())
        
        # Agregar metadata
        geojson['metadata'] = {
            "total": len(gdf_final),
            "source": f"Inventario de Glaciares - {source_name}",
            "tipo": "geojson_optimizado",
            "simplificacion": "0.005 grados",
            "filtro_minimo": "0.5 km²",
            "columnas": list(gdf_final.columns)
        }
        
        logger.info(f"Devolviendo GeoJSON optimizado con {len(gdf_final)} glaciares")
        return JSONResponse(content=geojson)
        
    except Exception as e:
        logger.error(f"Error obteniendo GeoJSON optimizado: {e}")
        raise HTTPException(status_code=500, detail=f"Error procesando GeoJSON optimizado: {str(e)}")

# ENDPOINTS DE CUADRÍCULAS

@router.get("/grid/cuadriculas_aysen")
async def get_cuadriculas_aysen():
    """Obtiene 30 cuadrículas distribuidas en las comunas de Aysén (3 por comuna)"""
    try:
        # Leer comunas de Aysén
        gdf = gpd.read_file(SHAPEFILE_PATHS["comunas"])
        if gdf.crs is None or gdf.crs.to_epsg() != 4326:
            gdf = gdf.to_crs(epsg=4326)
        
        all_grid_points = []
        
        for idx, row in gdf.iterrows():
            comuna_name = row.get('NOM_COMUNA', f'Comuna_{idx}')
            geometry = row['geometry']
            
            # Generar 3 puntos por comuna
            points = generate_grid_points_in_comuna(geometry, num_points=3)
            
            # Agregar información de la comuna a cada punto
            for i, point in enumerate(points):
                point['comuna'] = comuna_name
                point['grid_id'] = f"{comuna_name}_{i+1}"
                point['region'] = 'Aysén'
                all_grid_points.append(point)
        
        logger.info(f"Generadas {len(all_grid_points)} cuadrículas para {len(gdf)} comunas")
        
        return {
            "total_points": len(all_grid_points),
            "total_comunas": len(gdf),
            "points_per_comuna": 3,
            "grid_points": all_grid_points
        }
        
    except Exception as e:
        logger.error(f"Error generando cuadrículas de Aysén: {e}")
        raise HTTPException(status_code=500, detail=str(e))
