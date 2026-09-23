# Sistema Restaurante

Sistema de punto de venta para restaurante. HTML + CSS + JavaScript, sin dependencias.
Los datos se guardan en el navegador (`localStorage`).

**Demo en línea:** https://creyes14cabrera-bit.github.io/sistema-restaurante/

## Cómo usarlo

Abre `index.html` en el navegador, o sírvelo localmente:

```bash
python3 -m http.server 5580 --directory sistema-restaurante
```

## Módulos

- **Mesas**: mapa de mesas (libre / ocupada / pedido listo), pedidos para llevar.
- **Pedido**: agregar productos, notas por plato ("sin cebolla"), enviar comandas a cocina,
  cambiar de mesa, anular.
- **Cocina**: comandas en orden de llegada, tiempo de espera (alerta a los 20 min),
  estados Pendiente → Preparando → Listo → Entregado.
  Las categorías marcadas "no pasa por cocina" (p. ej. Bebidas) no generan comanda.
- **Cobro**: propina sugerida, descuento, división por personas, métodos de pago,
  cálculo de cambio, precuenta y recibo imprimible (impresora térmica 80 mm).
- **Menú**: categorías y productos, precios, marcar agotado.
- **Ventas**: filtro por fechas, total vendido, ticket promedio, propinas,
  ventas por método de pago, productos más vendidos, anular cuentas, exportar CSV.
- **Ajustes**: datos del restaurante, número de mesas, % de propina,
  copia de seguridad / restauración.

Tip: abre una pestaña en la vista **Cocina** en otra pantalla del mismo equipo;
se sincroniza automáticamente con la de los meseros.
