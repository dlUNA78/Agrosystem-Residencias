# Agrosystem-Residencias
La idea principal del proyecto es pasar del papel, a un sistema automatizado, actualmente el INIFAP hace sus registros en papel, llevando a mano, la lista de plagas, cultivos, terrenos, productos validados por el inifap, entre otras cosas.


graph TD
    %% Inicio y Autenticación
    Start([Inicio / Página Principal]) --> Auth{¿Tiene cuenta?}
    Auth -- No --> Registro[Registro de Usuario]
    Auth -- Sí --> Login[Inicio de Sesión]

    Registro --> Codigo{¿Ingresa código INIFAP?}
    Codigo -- No --> RolPublico(Asignar Rol: Público General)
    Codigo -- Sí --> ValidarCodigo[Validar Código INIFAP]
    
    ValidarCodigo -- Válido --> RolInifap(Asignar Rol: Usuario INIFAP)
    ValidarCodigo -- Inválido --> RolPublico

    Login --> CheckRol{Validación de Rol}
    RolPublico --> CheckRol
    RolInifap --> CheckRol

    %% Ramificación por roles
    CheckRol -- Público General --> MenuPublico[Panel: Comunidad General]
    CheckRol -- Usuario INIFAP --> MenuInifap[Panel: Solo INIFAP]
    CheckRol -- Administrador --> MenuAdmin[Panel: Administrador]

    %% Área Comunidad General
    subgraph Zona_Publica [Área: Comunidad General]
        MenuPublico --> P1[Ver Listados: Plagas, Cultivos, Productos]
        MenuPublico --> P2[Foro Comunitario: Fotos y Discusión]
        MenuPublico --> P3[Proponer Nueva Información]
        P3 --> BD_Temp[(Base de Datos: Pendientes)]
    end

    %% Área Solo INIFAP
    subgraph Zona_Inifap [Área: Exclusiva INIFAP]
        MenuInifap --> I1[Dashboard: Resumen y Reportes]
        MenuInifap --> I2[Consultar: Plagas, Cultivos, Productos]
        MenuInifap --> I3[Gestión de Terrenos/Predios]
        MenuInifap --> I4[Revisar Aportes de Comunidad]
        
        BD_Temp -.-> I4
        I4 -- "Valida y Aprueba" --> BD_Main[(Base de Datos Principal)]
    end

    %% Área Administrador
    subgraph Zona_Admin [Área: Administrador]
        MenuAdmin --> A1[Dashboard Global]
        MenuAdmin --> A2[Gestión de Usuarios]
        MenuAdmin --> A3[Generar Códigos INIFAP]
        MenuAdmin --> A4[CRUD Global: Plagas, Cultivos, Terrenos, etc.]
        
        A3 -.-> |Alimenta validador| ValidarCodigo
    end

    %% Conexiones a la BD Principal
    BD_Main -.-> |Alimenta vistas| P1
    BD_Main -.-> |Alimenta vistas| I2
    A4 <--> |Modifica todo| BD_Main

    classDef publico fill:#d4edda,stroke:#28a745,stroke-width:2px,color:#155724;
    classDef inifap fill:#cce5ff,stroke:#007bff,stroke-width:2px,color:#004085;
    classDef admin fill:#f8d7da,stroke:#dc3545,stroke-width:2px,color:#721c24;
    
    class MenuPublico,P1,P2,P3 publico;
    class MenuInifap,I1,I2,I3,I4 inifap;
    class MenuAdmin,A1,A2,A3,A4 admin
