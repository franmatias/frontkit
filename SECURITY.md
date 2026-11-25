# Seguridad

Comunica una vulnerabilidad de forma privada mediante **Security → Report a vulnerability** en GitHub, si está disponible. Si el formulario está deshabilitado, contacta en privado con la persona responsable del repositorio.

Incluye la versión, el navegador, el impacto y los pasos necesarios para reproducir el fallo con datos de prueba. Evita difundir detalles sensibles mientras se revisa el informe.

## Playground

La vista previa usa un iframe con origen opaco. Su política de contenido permite los estilos locales y el script del panel JavaScript. El documento padre carece de CSP inline para evitar que la vista previa herede restricciones incompatibles. El padre filtra los mensajes de consola por ventana y por identificador de ejecución. La instrumentación limita las iteraciones del panel JS. Un archivo HTML exportado ejecuta el código como un documento independiente.
