# CopoTech Presupuestos PWA

Aplicación web instalable para crear, guardar, descargar y compartir presupuestos de reparación de CopoTech Salta.

## Funciones incluidas

- Formulario de cliente, equipo, diagnóstico, trabajo y dos opciones de reparación.
- Vista previa A4 con la identidad visual oficial de CopoTech.
- Generación de PDF vectorial sin librerías externas.
- Historial local de presupuestos.
- Exportación e importación de respaldo JSON.
- Compartir PDF mediante el menú nativo de Android/iOS cuando el navegador lo permite.
- Instalación como PWA.
- Funcionamiento sin conexión después de la primera carga.

## Probarla en la MacBook

1. Descomprimí la carpeta.
2. Hacé doble clic en `start.command`.
3. Se abrirá `http://localhost:8080` en el navegador.
4. Si macOS bloquea el archivo, abrí Terminal dentro de la carpeta y ejecutá:

```bash
chmod +x start.command
./start.command
```

También se puede iniciar manualmente:

```bash
cd copotech-presupuestos-pwa
python3 -m http.server 8080
```

## Probarla desde Android o iPhone en la misma red

1. Iniciá la aplicación en la Mac.
2. Buscá la IP local de la Mac en Ajustes del Sistema > Wi‑Fi > Detalles.
3. Desde el celular abrí `http://IP-DE-LA-MAC:8080`.

La instalación PWA completa y el service worker requieren HTTPS, salvo cuando se usa `localhost`. Para instalarla en celulares conviene publicarla.

## Publicar gratis en GitHub Pages

1. Creá un repositorio nuevo en GitHub.
2. Subí todos los archivos de esta carpeta a la raíz del repositorio.
3. En GitHub abrí `Settings > Pages`.
4. En `Build and deployment`, elegí `Deploy from a branch`.
5. Seleccioná la rama `main` y la carpeta `/ (root)`.
6. Guardá y esperá la URL pública.

## Instalar en Android

- Abrí la URL en Chrome.
- Tocá el botón `Instalar` de la app o el menú de Chrome > `Agregar a pantalla principal`.

## Instalar en iPhone/iPad

- Abrí la URL en Safari.
- Tocá Compartir.
- Elegí `Agregar a pantalla de inicio`.

## Datos y copias de seguridad

Los presupuestos se guardan en el almacenamiento local de cada dispositivo. No se sincronizan entre la Mac, Android y iPhone. Usá `Historial > Exportar respaldo` para copiar los datos a otro dispositivo y `Importar respaldo` para restaurarlos.

## Archivos principales

- `index.html`: interfaz y plantilla visual.
- `styles.css`: diseño responsive y hoja A4.
- `app.js`: formulario, historial, PWA y generador PDF.
- `manifest.webmanifest`: instalación de la app.
- `sw.js`: funcionamiento sin conexión.


## Corrección visual v6

- Logo oficial extraído de la plantilla.
- Contactos reforzados.
- Metadatos alineados en dos columnas.
- Símbolo de seña centrado.
- Pie sin franja roja superpuesta.
