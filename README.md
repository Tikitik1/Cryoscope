## Equipo
- Jefe de proyecto: Juan Pablo Cárdenas
- Cientifica de datos: Florencia Castillo
- Desarrollador del simulador: Juan Pablo Cárdenas
- Desarrollador alerta: Florencia Castillo y Carlos Campos
- Desarrollador Atlas: Juan Salcedo y Maximiliano Alvarez
- Desplegamiento del sistema: Juan Salcedo

# Simulador de Deshielo de Glaciares -cryoscope

Una aplicación web interactiva para visualizar y simular el deshielo de glaciares en la región de Aysén, Chile.

---

# 🧊 Módulos Principales

## Simulador
Herramienta interactiva que permite modelar el proceso de deshielo de glaciares bajo diferentes escenarios climáticos. El usuario puede ajustar parámetros como temperatura, radiación solar y corrientes marinas para observar el impacto en el volumen glaciar y la formación de icebergs.

## Alerta
Sistema de monitoreo que detecta condiciones críticas en los glaciares y genera alertas automáticas. Las alertas pueden ser visualizadas en el dashboard y enviadas por correo electrónico a los usuarios registrados. Incluye umbrales configurables para temperatura, velocidad de deshielo y eventos extremos.

## Atlas
Repositorio geoespacial que integra mapas, inventarios y datos históricos de glaciares e icebergs. Permite explorar capas temáticas, consultar información detallada de cada glaciar y descargar datos en formatos estándar (GeoJSON, Shapefile, Excel).

---

## 🚀 Características

- **Mapa interactivo** con capas de temperatura, glaciares e icebergs
- **Datos reales** de ARCLIM, OpenMeteo y archivos locales de glaciares
- **Simulación de deshielo** basada en datos climáticos
- **Visualización 3D** del entorno glaciar
- **Dashboard responsivo** con tres paneles informativos
- **API REST** para acceso a datos
- **Alertas automáticas** por condiciones críticas
- **Atlas geoespacial** de glaciares e icebergs

## 🛠️ Tecnologías

### Frontend
- **Angular 19** - Framework web moderno
- **Leaflet** - Mapas interactivos con OpenStreetMap
- **TypeScript** - Desarrollo tipado
- **SCSS** - Estilos avanzados

### Backend
- **FastAPI** - API REST de alto rendimiento
- **GeoPandas** - Procesamiento de datos geoespaciales
- **Pandas** - Análisis de datos
- **Shapely** - Geometrías geoespaciales
- **Celery** - Gestión de alertas y tareas programadas

## 📋 Requisitos

- **Node.js** 18+ y npm
- **Python** 3.8+
- **Git**

### Endpoints principales:

- `GET /api/temperatura/comunas/2020` - Datos de temperatura por comunas 2020
- `GET /api/temperatura/comunas/2050` - Proyecciones de temperatura 2050
- `GET /api/icebergs` - Datos de icebergs en tiempo real
- `GET /api/glaciares/geojson` - Glaciares en formato GeoJSON
- `GET /api/docs` - Documentación interactiva de la API
- `GET /api/alertas` - Alertas activas y eventos críticos
- `GET /api/atlas/glaciares` - Inventario y detalles de glaciares

## 🗂️ Estructura del Proyecto

```
glaciares/
├── frontend/                 # Aplicación Angular
│   ├── src/
│   │   ├── app/
│   │   │   ├── components/   # Componentes de la UI
│   │   │   ├── services/     # Servicios para APIs
│   │   │   └── models/       # Interfaces TypeScript
│   │   └── styles.css        # Estilos globales
│   └── package.json
│
├── backend/                  # API FastAPI
│   ├── app.py               # Aplicación principal
│   ├── api.py               # Endpoints de la API
│   ├── datos/               # Archivos de datos
│   │   ├── *.geojson       # Datos geoespaciales
│   │   ├── *.shp           # Shapefiles de glaciares
│   │   └── *.xlsx          # Datos climáticos
│   └── requirements.txt
│
├── alertas/                 # Módulo de alertas y monitoreo
│   ├── celery.py            # Tareas programadas y notificaciones
│   └── config.py            # Configuración de umbrales
│
├── atlas/                   # Módulo Atlas geoespacial
│   ├── mapas/               # Capas y mapas temáticos
│   └── inventario/          # Inventario de glaciares
│
└── README.md
```

## 🌍 Capas del Mapa

### Datos de Temperatura
- **2020**: Datos históricos por comuna
- **2050**: Proyecciones climáticas SSP5-8.5

### Glaciares
- Inventario de Glaciares 2022
- Glaciares de Aysén-Magallanes
- Glaciares históricos de la región

### Icebergs
- Datos simulados en tiempo real
- Posición, tamaño y velocidad
- Integración con corrientes marinas

### Alertas
- Visualización de zonas críticas y eventos extremos
- Panel de notificaciones en tiempo real

### Atlas
- Consulta y descarga de datos geoespaciales
- Filtros por tipo, región y estado del glaciar

## 🎮 Cómo Usar

1. **Explorar el mapa**: Use los controles de zoom y panorámica
2. **Activar/desactivar capas**: Use los checkboxes en el panel de control
3. **Ver información**: Haga clic en cualquier elemento del mapa
4. **Simular deshielo**: Use el botón en el panel izquierdo
5. **Analizar resultados**: Revise las estadísticas en el panel derecho
6. **Recibir alertas**: Active las notificaciones y revise el panel de alertas
7. **Explorar el Atlas**: Acceda al inventario y mapas temáticos desde el menú principal

## 🔬 Simulación de Deshielo

La simulación considera:
- **Temperatura ambiente** actual y proyectada
- **Radiación solar** estacional
- **Corrientes marinas** y temperatura del agua
- **Volumen inicial** de glaciares
- **Factores de deshielo** calibrados

## 🚨 Sistema de Alertas

El sistema de alertas monitorea en tiempo real los parámetros críticos y genera notificaciones automáticas cuando se detectan condiciones de riesgo, como aumento acelerado de temperatura, deshielo extremo o eventos inusuales en los glaciares.

## 🗺️ Atlas Geoespacial

El Atlas permite explorar el inventario completo de glaciares e icebergs, consultar información histórica y descargar datos para análisis externo. Incluye filtros avanzados y visualización por capas temáticas.

## 📞 Contacto

Para preguntas sobre este proyecto, crear un issue en el repositorio.

---

**Nota**: Este es un proyecto de investigación y simulación. Los datos pueden no reflejar exactamente las condiciones reales actuales.
