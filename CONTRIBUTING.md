# Contribuir a FrontKit

Revisa el apartado correspondiente de la especificación antes de abrir un cambio. Describe el comportamiento esperado en una issue cuando el cambio afecte a la arquitectura o a varias herramientas.

Cada herramienta usa un identificador kebab-case, una vista diferida, un esquema Valibot y lógica de generación independiente de Vue. Registra sus textos en los mensajes españoles y prueba las exportaciones con Tailwind 4.1. Para los cambios de interfaz, comprueba teclado, móvil y ambos temas.

Ejecuta los controles del [README](README.md) antes de abrir una solicitud de cambios.

Ejecuta `pnpm new:tool <id>` para crear una vista, su esquema, la lógica y una prueba inicial. Edita el nombre, la categoría y los mensajes antes de publicar la herramienta.
