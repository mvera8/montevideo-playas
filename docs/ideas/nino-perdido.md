# Alerta de niño perdido

**Estado:** descartada por ahora (15/10/2026). No pensamos hacerla: queda anotada por las
preocupaciones de abajo, que sirven para cualquier función que muestre personas o ubicaciones en vivo.

## La idea

Una alerta propia de la app para cuando se pierde un niño en la playa, para que la gente que está
cerca pueda ayudar a buscarlo.

## Primeras notas

### La app no reemplaza el protocolo oficial

Cuando se pierde un niño, lo primero es avisar al **guardavidas** y llamar al **911**. Cualquier cosa
que hagamos tiene que empujar a eso primero, nunca demorarlo.

**Parte fácil, útil y sin riesgo:** un botón "Perdí a un niño" que muestre la **casilla de guardavidas
más cercana** (las casillas ya están en el mapa, ver `im.ts`), cómo llegar y un botón para llamar
al 911. No necesita cuentas ni guardar datos. Conviene hacer esto primero aunque el resto no se haga
nunca.

A verificar: cómo es hoy el protocolo de los guardavidas de Montevideo (adónde llevan a los niños
encontrados, si hay un punto de encuentro, si la IM reparte pulseras identificatorias en temporada).

### La alerta a otros usuarios: riesgos

- **Mal uso:** alguien podría usarla para encontrar a un niño que no es suyo (un depredador o una
  pelea por la tenencia). Es el riesgo principal y no hay forma de verificar quién es el padre o la madre.
- **Datos de menores:** foto, nombre o descripción de un niño publicados con su ubicación. Es delicado
  por la ley de protección de datos (18.331) y por el Código de la Niñez y la Adolescencia. Cambia la
  política de privacidad.
- **Falsas alarmas y bromas:** generan pánico.
- **Responsabilidad legal:** si la app "falla" (no llega la alerta, llega tarde), aunque nunca
  prometamos nada.

### Si se hace, con estos límites (a discutir)

- Sin foto ni nombre: solo edad aproximada, ropa y en qué playa y a qué hora se lo vio por última vez.
- Solo la ve quien está cerca (~500 m, ubicación del navegador) y dura poco (1–2 h, o hasta que la
  cierran con "Ya apareció"). Nunca queda pública ni indexada.
- El mensaje para quien la ve: **"Si lo ves, llevalo o avisá al guardavidas o al 911"**, no "contactá
  a quien lo perdió". Sin contacto directo entre desconocidos.
- Límite de alertas por cuenta y por dispositivo, y que quien reporta esté en la playa.
- Ideal: que la valide o la emita el guardavidas, no cualquier usuario. Necesita hablar con la IM.
- Avisos en el momento: harían falta notificaciones push (Web Push), que hoy no tenemos. Sin push, la
  alerta solo la ve quien tiene la app abierta, y sirve de poco.

### Reutiliza

La base de los [reportes en la playa](reportes-playa.md) (Supabase, cuenta anónima, ubicación,
reportes que vencen solos) y las casillas del mapa.

## Para avanzar hay que decidir

1. ¿Se hace solo la parte "casilla más cercana + 911", o también la alerta a otros usuarios?
2. Si hay alerta: ¿la emite cualquiera o solo el guardavidas o la IM? (Esto implica hablar con la IM.)
3. ¿Hay presupuesto y ganas de sumar notificaciones push?
