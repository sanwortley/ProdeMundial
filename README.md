# Prode Mundial 🏆⚽

Aplicación web móvil-first para organizar y jugar al Prode del Mundial entre grupos de amigos.

---

## Requisitos Previos

Asegúrate de tener instalado:
- **Node.js** (versión 18 o superior)
- **Python** (versión 3.9 o superior)
- **PostgreSQL** (opcional, por defecto utiliza SQLite local para desarrollo rápido)

---

## Estructura del Proyecto

```text
prode-mundial/
  backend/           <-- API hecha con FastAPI
    app/
      main.py
      database.py
      models.py
      schemas.py
      auth.py
      utils.py
      routes/
    requirements.txt
    .env.example
  frontend/          <-- App hecha con React + Vite + Tailwind CSS
    src/
    package.json
    .env.example
```

---

## Configuración y Ejecución del Backend

1. **Navegar a la carpeta del backend:**
   ```bash
   cd backend
   ```

2. **Crear y activar un entorno virtual (Recomendado):**
   * En Windows:
     ```bash
     python -m venv venv
     venv\Scripts\activate
     ```
   * En macOS/Linux:
     ```bash
     python3 -m venv venv
     source venv/bin/activate
     ```

3. **Instalar dependencias:**
   ```bash
   pip install -r requirements.txt
   ```

4. **Configurar variables de entorno (`.env`):**
   Copia el archivo de ejemplo:
   ```bash
   cp .env.example .env
   ```
   Abre el archivo `.env` y configúralo:
   * **Base de datos PostgreSQL**: Configura tu URL de conexión en la variable `DATABASE_URL` (Ej: `postgresql://usuario:contraseña@localhost:5432/prodedb`).
   * **SQLite (por defecto)**: Si no configuras nada o dejas `DATABASE_URL=sqlite:///./prode.db`, el sistema creará un archivo SQLite local automáticamente. Las tablas se autogeneran al arrancar la aplicación.

5. **Iniciar el servidor de desarrollo:**
   ```bash
   uvicorn app.main:app --reload
   ```
   La API estará disponible en `http://localhost:8000`. Puedes acceder a la documentación interactiva en `http://localhost:8000/docs`.

---

## Configuración y Ejecución del Frontend

1. **Navegar a la carpeta del frontend:**
   ```bash
   cd ../frontend
   ```

2. **Instalar las dependencias de Node.js:**
   ```bash
   npm install
   ```

3. **Configurar variables de entorno (`.env`):**
   Copia el archivo de ejemplo:
   ```bash
   cp .env.example .env
   ```
   Por defecto, ya está apuntando a `http://localhost:8000` (el puerto de desarrollo del backend).

4. **Ejecutar el servidor de desarrollo Vite:**
   ```bash
   npm run dev
   ```
   El frontend se levantará en `http://localhost:5173`. Abre esa URL en tu navegador (usa la vista móvil o simula un dispositivo para la mejor experiencia).

---

## Reglas del Prode y Puntos

- **Acierto exacto:** 10 puntos.
- **Acierto de ganador o empate (pero no goles exactos):** 5 puntos.
- **Predicción errónea:** 0 puntos.
- **Bonus de Racha:** +15 puntos por cada 5 aciertos seguidos (cualquier predicción terminada con puntos > 0).
- **Partido Doble (1 por fecha/fase):** Multiplica por 2 el acierto exacto (+20 puntos). Si se erra el resultado exacto, suma 0 (incluso si se acertó el ganador).
- **Joker Único (1 por todo el torneo por grupo):** Multiplica por 3 el acierto exacto (+30 puntos). Si se falla el resultado exacto, resta 10 puntos (-10 puntos).
- **Campeón del torneo:** +50 puntos adicionales si se acierta al equipo campeón antes de que comience el primer partido.

---

## Cómo Probar (Simulador Integrado)

El sistema cuenta con un **Simulador del Torneo** integrado para facilitar el testeo completo del MVP de forma interactiva:
1. Regístrate en la aplicación e inicia sesión.
2. Crea un grupo privado. Se generará un código único (Ej: `MUNDIAL-A7K9`).
3. Ve a la sección **Ajustes / Configuración** de ese grupo (como creador).
4. Abajo verás el **Simulador del Torneo**.
5. Agrega partidos de prueba (Ej: Argentina vs Brasil, Fase de Grupos).
6. Ve a la pantalla de **Pronósticos** y carga tus predicciones (puedes activar Joker o Partido Doble).
7. Vuelve a **Ajustes** y en el simulador coloca el resultado real del partido y presiona **Aplicar Resultado**.
8. Ve a la **Tabla de Posiciones** y verás cómo los puntos se recalculan de inmediato siguiendo todas las reglas.
