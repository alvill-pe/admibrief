/* «Clave para el administrador»: motor de reglas local y gratuito.
   Lee el titular y el resumen, detecta el tema y devuelve:
   - área de la empresa afectada, factor PESTEL, concepto a aprender y una pregunta de reflexión.
   Las palabras clave van sin tildes y en minúsculas. Un "$" al final exige palabra completa. */
(function (G) {
  const R = [
    { k: ['inflacion', 'ipc', 'alza de precios', 'precios al consumidor', 'canasta basica', 'costo de vida'],
      area: 'Finanzas', pestel: 'Económico', concept: 'Inflación y poder adquisitivo', w: 3,
      note: 'Cuando suben los precios, los costos de la empresa y el poder de compra del cliente cambian. Un administrador revisa precios de venta, contratos con proveedores y márgenes.',
      q: '¿Qué costos de una empresa que conoces subirían primero y cómo protegerías su margen?' },
    { k: ['tasa de referencia', 'tasa de interes', 'bcrp', 'banco central', 'reserva federal', 'la fed', 'fed$', 'politica monetaria'],
      area: 'Finanzas', pestel: 'Económico', concept: 'Costo del dinero y financiamiento', w: 3,
      note: 'La tasa de interés define cuánto cuesta endeudarse. Afecta créditos, inversión en proyectos (VAN/TIR) y el consumo de los clientes.',
      q: 'Si la tasa baja 0,25 puntos, ¿conviene adelantar una inversión financiada con deuda?' },
    { k: ['tipo de cambio', 'dolar', 'sol peruano', 'devaluacion', 'divisas'],
      area: 'Finanzas internacionales', pestel: 'Económico', concept: 'Riesgo cambiario', w: 3,
      note: 'Si la empresa importa insumos o tiene deudas en dólares, una subida del tipo de cambio eleva sus costos. Las exportadoras, en cambio, ganan competitividad.',
      q: '¿Tu empresa de referencia compra o vende en dólares? ¿Quién gana y quién pierde con este movimiento?' },
    { k: ['pbi', 'producto bruto', 'crecimiento economico', 'recesion', 'desaceleracion', 'actividad economica', 'proyeccion de crecimiento'],
      area: 'Estrategia', pestel: 'Económico', concept: 'Ciclo económico y demanda', w: 3,
      note: 'El ritmo de la economía anticipa cuánto venderán las empresas. En expansión se invierte y contrata; en desaceleración se cuida la liquidez.',
      q: '¿Qué sectores se benefician primero cuando la economía acelera?' },
    { k: ['arancel', 'exportacion', 'importacion', 'tratado de libre comercio', 'tlc$', 'balanza comercial', 'comercio exterior', 'aduana', 'proteccionismo'],
      area: 'Comercio internacional', pestel: 'Económico / Político', concept: 'Comercio exterior y aranceles', w: 3,
      note: 'Los aranceles y acuerdos comerciales cambian precios, mercados de destino y proveedores. Obligan a repensar dónde comprar y a quién vender.',
      q: '¿Qué producto peruano se vería más afectado por esta medida y por qué?' },
    { k: ['sunat', 'impuesto', 'igv', 'tributari', 'renta de tercera', 'evasion', 'recaudacion', 'detracciones'],
      area: 'Contabilidad y tributación', pestel: 'Legal', concept: 'Carga tributaria y cumplimiento', w: 3,
      note: 'Los cambios tributarios alteran el flujo de caja y la formalización. Un administrador planifica el pago de impuestos y evalúa regímenes (RUS, RER, MYPE Tributario).',
      q: '¿Qué régimen tributario le convendría a una microempresa con este cambio?' },
    { k: ['empleo', 'desempleo', 'remuneracion minima', 'sueldo minimo', 'salario', 'cts$', 'gratificacion', 'laboral', 'trabajadores', 'sindicato', 'huelga', 'informalidad'],
      area: 'Recursos Humanos', pestel: 'Social / Legal', concept: 'Gestión del talento y costos laborales', w: 3,
      note: 'El mercado laboral define cuánto cuesta contratar y retener talento. Las normas laborales cambian planillas, beneficios y la relación con los trabajadores.',
      q: '¿Cómo afectaría esto a la planilla y al clima laboral de una empresa mediana?' },
    { k: ['congreso', 'presidente', 'presidenta', 'vacancia', 'gabinete', 'premier', 'ministro', 'ministra', 'elecciones', 'jne$', 'onpe$', 'candidato', 'censura', 'interpelacion', 'ejecutivo'],
      area: 'Entorno y estrategia', pestel: 'Político', concept: 'Estabilidad política e inversión', w: 2,
      note: 'La inestabilidad política eleva la incertidumbre: las empresas postergan inversiones y el riesgo país sube. Seguir la política es parte del análisis del entorno.',
      q: '¿Esta noticia aumenta o reduce la confianza de un inversionista? ¿Por qué?' },
    { k: ['ley$', 'decreto', 'reglamento', 'regulacion', 'norma$', 'normas$','indecopi', 'sunafil', 'osinergmin', 'sbs$', 'osiptel'],
      area: 'Legal y cumplimiento', pestel: 'Legal', concept: 'Marco regulatorio', w: 2,
      note: 'Las nuevas normas crean obligaciones y oportunidades. El administrador evalúa el costo de cumplir y los riesgos de no hacerlo (multas, reputación).',
      q: '¿Qué tendría que cambiar una empresa para cumplir esta norma?' },
    { k: ['mineria', 'minera', 'cobre', 'oro$', 'zinc', 'conflicto social', 'canon'],
      area: 'Estrategia sectorial', pestel: 'Económico / Social', concept: 'Sectores clave del Perú', w: 2,
      note: 'La minería es un motor del PBI y de la recaudación. Sus precios y conflictos influyen en el tipo de cambio, el empleo regional y la inversión.',
      q: '¿Qué otras empresas (proveedores, servicios, comercio local) dependen de esta actividad?' },
    { k: ['inteligencia artificial', 'ia$', 'chatgpt', 'automatizacion', 'transformacion digital', 'tecnologia', 'ciberseguridad', 'fintech', 'comercio electronico', 'e-commerce', 'startup'],
      area: 'Innovación y TI', pestel: 'Tecnológico', concept: 'Transformación digital', w: 3,
      note: 'La tecnología cambia cómo se produce, vende y compite. Un administrador identifica qué procesos automatizar y qué habilidades necesitará su equipo.',
      q: '¿Qué proceso de una empresa que conoces podría mejorar con esta tecnología?' },
    { k: ['mype', 'mypes', 'pyme', 'pymes', 'emprend', 'microempresa', 'pequena empresa', 'reactiva', 'impulso myperu', 'cofide'],
      area: 'Emprendimiento', pestel: 'Económico', concept: 'Gestión de MYPE', w: 3,
      note: 'Las MYPE son la mayor fuente de empleo en el Perú. Financiamiento, formalización y productividad son sus retos centrales.',
      q: '¿Qué le recomendarías a una MYPE de tu ciudad a partir de esta noticia?' },
    { k: ['liderazgo', 'lider', 'management', 'gerente', 'ceo$', 'cultura organizacional', 'productividad', 'equipo de trabajo', 'gestion del cambio', 'toma de decisiones', 'trabajo remoto', 'teletrabajo'],
      area: 'Dirección', pestel: 'Social', concept: 'Liderazgo y comportamiento organizacional', w: 3,
      note: 'Cómo se dirige a las personas define resultados. Aquí hay una lección práctica de dirección que puedes aplicar en equipos de trabajo.',
      q: '¿Qué harías distinto si fueras el gerente en esta situación?' },
    { k: ['marketing', 'consumidor', 'consumo', 'ventas', 'retail', 'marca', 'publicidad', 'supermercado', 'centro comercial', 'clientes'],
      area: 'Marketing', pestel: 'Social / Económico', concept: 'Comportamiento del consumidor', w: 2,
      note: 'Los cambios en el consumo obligan a ajustar producto, precio, plaza y promoción (4P). Esta noticia muestra cómo se mueve el cliente.',
      q: '¿Qué ajustarías en las 4P de una marca ante este escenario?' },
    { k: ['logistic', 'cadena de suministro', 'puerto', 'chancay', 'transporte', 'carretera', 'flete', 'almacen', 'inventario', 'distribucion'],
      area: 'Operaciones y logística', pestel: 'Económico / Tecnológico', concept: 'Cadena de suministro', w: 3,
      note: 'La logística define costos, tiempos de entrega e inventarios. Infraestructura y transporte pueden abrir mercados o crear cuellos de botella.',
      q: '¿Cómo cambiaría el costo y el tiempo de llevar un producto de tu región al mercado?' },
    { k: ['el nino', 'fenomeno', 'lluvias', 'huaico', 'sequia', 'cambio climatico', 'clima', 'sismo', 'friaje', 'inundacion', 'emergencia'],
      area: 'Gestión de riesgos', pestel: 'Ecológico', concept: 'Continuidad del negocio', w: 2,
      note: 'Los eventos climáticos interrumpen producción, transporte y ventas. Las empresas preparadas tienen planes de contingencia y seguros.',
      q: '¿Qué plan de contingencia debería tener una empresa expuesta a este riesgo?' },
    { k: ['corrupcion', 'lavado de activos', 'fiscalia', 'soborno', 'colusion', 'contraloria', 'compliance', 'etica'],
      area: 'Gobierno corporativo', pestel: 'Legal / Político', concept: 'Ética y cumplimiento (compliance)', w: 2,
      note: 'Los casos de corrupción dañan reputación, contratos y acceso a financiamiento. Por eso las empresas implementan códigos de ética y sistemas de prevención.',
      q: '¿Qué controles internos habrían evitado este problema?' },
    { k: ['bolsa', 'acciones', 'bvl$', 'wall street', 'mercado de valores', 'bonos', 'inversionistas', 'riesgo pais', 'calificacion crediticia', 'moodys', 'fitch'],
      area: 'Finanzas corporativas', pestel: 'Económico', concept: 'Mercado de capitales', w: 2,
      note: 'Los mercados reflejan expectativas sobre empresas y países. El riesgo país y las calificaciones encarecen o abaratan el financiamiento.',
      q: '¿Qué le dice este movimiento a una empresa que quiere emitir deuda?' },
    { k: ['petroleo', 'combustible', 'gasolina', 'diesel', 'balon de gas', 'glp$', 'energia', 'electricidad', 'tarifa'],
      area: 'Costos y operaciones', pestel: 'Económico', concept: 'Estructura de costos', w: 2,
      note: 'Energía y combustibles impactan casi todos los costos (transporte, producción). Su variación se traslada a precios finales.',
      q: '¿En qué porcentaje de sus costos depende una empresa de transporte del combustible?' },
    { k: ['china', 'estados unidos', 'ee. uu', 'eeuu', 'trump', 'guerra', 'otan', 'union europea', 'geopolit', 'sanciones', 'ucrania', 'rusia', 'medio oriente', 'israel'],
      area: 'Entorno internacional', pestel: 'Político / Económico', concept: 'Geopolítica y negocios', w: 2,
      note: 'Las tensiones entre potencias mueven precios de materias primas, comercio y tipo de cambio. El Perú, como economía abierta, siente esos efectos.',
      q: '¿Por qué canal (precios, comercio, inversión) llegaría esto a una empresa peruana?' },
    { k: ['inversion', 'proyecto', 'concesion', 'obras por impuestos', 'asociacion publico', 'app$', 'proinversion', 'infraestructura'],
      area: 'Evaluación de proyectos', pestel: 'Económico', concept: 'Decisiones de inversión', w: 2,
      note: 'Detrás de cada proyecto hay un análisis de costo-beneficio, riesgos y retorno. Es un buen caso para pensar en VAN, TIR y periodo de recuperación.',
      q: '¿Qué riesgos considerarías antes de aprobar este proyecto?' },
    { k: ['banco', 'credito', 'morosidad', 'prestamo', 'cajas municipales', 'financiera', 'tarjeta', 'afp$', 'pension', 'ahorro'],
      area: 'Sistema financiero', pestel: 'Económico', concept: 'Acceso a financiamiento', w: 2,
      note: 'El crédito es combustible para empresas y familias. La morosidad y las condiciones de préstamo indican la salud financiera del mercado.',
      q: '¿Cómo afecta esto la capacidad de una MYPE para conseguir un préstamo?' },
    { k: ['agroexport', 'arandano', 'palta', 'mango', 'uva', 'agricultur', 'agro$', 'pesca', 'anchoveta', 'harina de pescado'],
      area: 'Estrategia sectorial', pestel: 'Económico / Ecológico', concept: 'Agroexportación y recursos', w: 2,
      note: 'El agro y la pesca son motores del norte peruano. Precios internacionales, clima y certificaciones definen su competitividad.',
      q: '¿Qué ventaja competitiva tiene el Perú en este producto y cómo podría perderla?' },
    { k: ['turismo', 'turistas', 'hotel', 'restaurante', 'gastronomia', 'machu picchu', 'aerolinea', 'aeropuerto', 'vuelos'],
      area: 'Servicios', pestel: 'Social / Económico', concept: 'Gestión de servicios', w: 2,
      note: 'El turismo genera empleo y divisas. Su gestión depende de la experiencia del cliente, la conectividad y la seguridad.',
      q: '¿Qué indicador usarías para medir el impacto de esto en un negocio turístico?' },
    { k: ['sostenib', 'esg$', 'responsabilidad social', 'medio ambiente', 'ambiental', 'contaminacion', 'reciclaje', 'carbono'],
      area: 'Responsabilidad social', pestel: 'Ecológico / Social', concept: 'Sostenibilidad empresarial', w: 2,
      note: 'Clientes, inversionistas y reguladores exigen prácticas sostenibles. La RSE ya no es solo imagen: influye en costos, financiamiento y reputación.',
      q: '¿Qué indicador de sostenibilidad debería reportar una empresa de este sector?' },
    { k: ['inseguridad', 'extorsion', 'delincuencia', 'criminalidad', 'sicariato', 'paro de transportistas', 'estado de emergencia'],
      area: 'Gestión de riesgos', pestel: 'Social / Político', concept: 'Seguridad y continuidad operativa', w: 2,
      note: 'La inseguridad eleva costos (vigilancia, seguros), reduce horarios de atención y afecta la confianza del consumidor.',
      q: '¿Qué medidas tomarías para proteger a trabajadores y clientes sin paralizar el negocio?' },
    { k: ['educacion', 'universidad', 'sunedu', 'estudiantes', 'salud', 'essalud', 'minsa', 'pobreza', 'demograf', 'migracion'],
      area: 'Entorno social', pestel: 'Social', concept: 'Tendencias sociales', w: 1,
      note: 'Los cambios sociales definen el mercado de mañana: qué demandarán las personas y qué talento estará disponible.',
      q: '¿Qué oportunidad de negocio abre esta tendencia?' }
  ];

  const norm = (s) => (s || '').toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '');
  const esc = (s) => s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');

  // Compila cada palabra clave a una expresión regular (inicio de palabra; "$" = palabra completa).
  R.forEach((r) => {
    r.re = r.k.map((kw) => {
      const whole = kw.endsWith('$');
      const base = esc(whole ? kw.slice(0, -1) : kw.trim());
      return new RegExp('(^|[^a-z0-9])' + base + (whole ? '(?![a-z0-9])' : ''));
    });
  });

  const FALLBACK = {
    area: 'Análisis del entorno', pestel: 'PESTEL', concept: 'Lectura estratégica', w: 0,
    note: 'Toda noticia es un dato del entorno. Pregúntate qué factor cambia (político, económico, social, tecnológico, ecológico o legal) y a qué empresas afecta.',
    q: '¿Esto es una oportunidad o una amenaza para un negocio de tu región?'
  };

  /** Devuelve { area, pestel, concept, note, q, score, topics[] } */
  G.analyzeNews = function (title, summary) {
    const t = norm(title);
    const all = t + ' ' + norm(summary);
    let best = null, bestHits = 0, score = 0;
    const topics = [];
    for (const r of R) {
      let hits = 0;
      for (const re of r.re) {
        if (re.test(t)) hits += 2;          // en el titular pesa más
        else if (re.test(all)) hits += 1;
      }
      if (hits) {
        score += r.w * Math.min(hits, 3);
        topics.push(r.concept);
        if (hits * r.w > bestHits) { bestHits = hits * r.w; best = r; }
      }
    }
    const b = best || FALLBACK;
    return { area: b.area, pestel: b.pestel, concept: b.concept, note: b.note, q: b.q, score, topics };
  };
  G.normText = norm;
})(typeof window !== "undefined" ? window : globalThis);
