# Atlas Vivo v1.2 — Solo localStorage

Atlas de América Central con mapas interactivos, regiones seleccionables, fichas editables y fotos propias, sin Firebase ni cuentas de usuario.

## Ejecutar en Windows

1. Instalar Node.js 20 o superior.
2. Descomprimir este ZIP y abrir la carpeta `AtlasInteractivo` en VS Code.
3. Ejecutar `npm install` y luego `npm run dev`.
4. Abrir la URL que muestre Vite (normalmente http://localhost:5173).

## Editar

Elegir país, tocar un departamento y pulsar **Editar información y fotos**. También puede usarse **Editar contenido** o **Crear contenido**. Escribir y subir imágenes y, finalmente, pulsar **Guardar cambios**. Los archivos se reducen a WebP para consumir menos espacio. La ficha aparecerá inmediatamente.

## Proyectar

Pulsar **Pantalla completa** en el encabezado del mapa. Pulsar **Salir** o la tecla Esc para regresar.

## Almacenamiento y limitaciones

- Se usa exclusivamente `localStorage` bajo la clave `atlas-vivo-v1`; se mantienen los registros de la versión anterior guardados bajo esa clave en el mismo origen.
- No hay autenticación: cualquiera que utilice el navegador puede editar los datos de ese navegador.
- Los datos y fotos **no** se comparten con otros visitantes ni se sincronizan entre computadoras, teléfonos, navegadores o dominios.
- Si se borra el almacenamiento del sitio o se cambia de navegador, se perderá el contenido almacenado ahí.
- El espacio disponible suele ser limitado (varios MB): puede fallar al guardar demasiadas fotografías. La app avisa en ese caso. Para una biblioteca de muchas fotos es preferible IndexedDB o un servidor.
- Los mapas geográficos se consultan por Internet (geoBoundaries y GitHub); no están incorporados para uso desconectado.
- No se requiere configurar Firebase, claves, backend ni cuentas de administrador.

## Compilar

`npm run build` crea la carpeta `dist/` lista para desplegar en Vercel.
