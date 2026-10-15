# Bicicleteros y estacionamientos cerca de cada playa

**Estado:** idea (15/10/2026). **Antes de hacerla, medir si vale la pena** (ver abajo).

## La idea

Mostrar en el mapa y en la ficha de cada playa dónde dejar la bici o el auto.

## Por qué es poco trabajo

[servicios.ts](../../src/lib/servicios.ts) ya le pide a OpenStreetMap (Overpass) los baños, bebederos
y duchas con una sola consulta:

```
nwr["amenity"~"^(toilets|drinking_water|shower)$"](BBOX)
```

Los bicicleteros son `amenity=bicycle_parking` y los estacionamientos `amenity=parking`. Se suman a la
misma lista: sigue siendo **un solo pedido**, con el mismo caché de 24 h, el mismo cálculo de distancia a
la playa (`RADIO_SERVICIOS`, 600 m) y el mismo aviso de dato viejo (`DIAS_VIGENCIA_OSM`). Faltaría:
leer las etiquetas propias de estos puntos, un ícono en el mapa y una línea en la ficha.

## Chequeo antes de hacerla

Primera medición (15/10/2026), en **toda** la caja de `servicios.ts` (`-34.95,-56.45,-34.83,-56.02`, que
toma buena parte de la ciudad, no solo la costa):

| | Total | Detalle |
|---|---|---|
| Estacionamientos (`parking`) | 311 | 137 privados o solo para clientes (`access=private/customers/no`): se descartan. 164 dicen si son pagos (`fee`), 49 la capacidad. |
| Bicicleteros (`bicycle_parking`) | 42 | 25 con capacidad. |

Falta la medición que importa: **cuántos quedan a menos de 600 m de cada casilla**, playa por playa. Si
la mayoría de las playas queda sin bicicleteros o con estacionamientos que no son de la rambla, no vale
la pena (o vale solo para estacionamientos). Ver también la fecha de última edición: si casi todo es
viejo, se mostraría casi todo con el aviso de desactualizado.

Mismo caso que los baños de temporada: dependemos de lo que cargue la comunidad. Que no figure en el
mapa no quiere decir que no exista, y la interfaz lo tiene que aclarar.

## Si se hace

- Descartar los privados y los de clientes (shoppings, edificios).
- Mostrar si es pago y la capacidad cuando estén cargados; no inventar nada cuando no estén.
- Estacionamiento sobre la calle (`parking:lane` / `parking:both`) es otra etiqueta y está mucho menos
  cargado: dejarlo afuera salvo que la medición diga otra cosa.
- README (sección de servicios) y legales: es la misma fuente, OSM (ODbL), que ya se cita.
