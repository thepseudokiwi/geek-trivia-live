import { z } from 'zod';

const hex = z.string().regex(/^#[0-9a-fA-F]{6}([0-9a-fA-F]{2})?$/, 'Use a six- or eight-digit hex color.');
const opacity = z.number().min(0).max(1);
const px = z.number().min(0).max(4000);
const percent = z.number().min(0).max(100);
const safeText = z.string().max(160).refine(value => !/[<>`{};]/.test(value), 'Unsupported characters.');
const fontFamily = z.string().min(1).max(160).refine(value => /^[a-zA-Z0-9 _,'"-]+$/.test(value), 'Unsafe font family.');
const assetId = z.string().uuid().nullable();

export const positionSchema = z.object({
  x: percent, y: percent, width: percent.min(1), height: percent.min(1),
  anchor: z.enum(['top-left','top','top-right','left','center','right','bottom-left','bottom','bottom-right']),
  locked: z.boolean(), hidden: z.boolean(), zIndex: z.number().int().min(0).max(100),
});

const backgroundSchema = z.discriminatedUnion('type', [
  z.object({ type: z.literal('solid'), color: hex, opacity }),
  z.object({ type: z.literal('transparent') }),
  z.object({ type: z.literal('linear-gradient'), angle: z.number().min(0).max(360), stops: z.array(z.object({ position: percent, color: hex, opacity })).min(2).max(8) }),
  z.object({ type: z.literal('radial-gradient'), shape: z.enum(['circle','ellipse']), stops: z.array(z.object({ position: percent, color: hex, opacity })).min(2).max(8) }),
  z.object({ type: z.literal('image'), assetId, fit: z.enum(['cover','contain','fill']), position: z.enum(['center','top','bottom','left','right']), repeat: z.enum(['no-repeat','repeat','repeat-x','repeat-y']), opacity, blur: z.number().min(0).max(40), overlayColor: hex, overlayOpacity: opacity }),
  z.object({ type: z.literal('video'), assetId, fit: z.enum(['cover','contain','fill']), loop: z.boolean(), muted: z.literal(true), playbackRate: z.number().min(.25).max(2), fallbackAssetId: assetId, reducedMotionFallback: z.enum(['solid','image']) }),
  z.object({ type: z.literal('pattern'), pattern: z.enum(['grid','dots','diagonal','stars','scanlines']), color: hex, opacity, scale: z.number().min(.25).max(8), animated: z.boolean() }),
]);

const typographySchema = z.object({
  fontFamily, fallback: fontFamily, weight: z.number().int().min(100).max(900), style: z.enum(['normal','italic']),
  size: z.number().min(10).max(240), minSize: z.number().min(8).max(120), maxSize: z.number().min(10).max(300),
  lineHeight: z.number().min(.7).max(3), letterSpacing: z.number().min(-10).max(40), transform: z.enum(['none','uppercase','lowercase','capitalize']),
  align: z.enum(['left','center','right']), color: hex, shadow: z.number().min(0).max(20), outline: z.number().min(0).max(10),
  maxLines: z.number().int().min(1).max(20), autoFit: z.boolean(), overflow: z.enum(['shrink','ellipsis','wrap','clip']),
});

const panelSchema = z.object({
  preset: z.enum(['flat','glass','neon','metallic','paper','arcade','minimal','broadcast']), background: backgroundSchema,
  borderColor: hex, borderWidth: z.number().min(0).max(20), borderStyle: z.enum(['solid','double','dashed','none']), radius: z.number().min(0).max(120),
  shadow: z.number().min(0).max(100), glow: z.number().min(0).max(100), backdropBlur: z.number().min(0).max(40), padding: px.max(200), opacity,
  accentStripe: z.boolean(), decorativePattern: z.enum(['none','grid','dots','diagonal','scanlines']), headerTreatment: z.enum(['plain','band','accent']), footerTreatment: z.enum(['plain','band','accent']),
});

const elementSchema = z.object({ position: positionSchema, panel: panelSchema, transition: z.enum(['cut','fade','slide-left','slide-right','slide-up','zoom','wipe','glitch','iris','reveal']) });
const semanticColors = ['primary','secondary','accent','background','surface','elevatedSurface','text','mutedText','border','success','warning','error','leader','tie','completed','skipped','selected','disabled','timerNormal','timerWarning','timerExpired','natural1','natural20'] as const;
const colorShape = Object.fromEntries(semanticColors.map(key => [key, hex])) as Record<typeof semanticColors[number], typeof hex>;
const typeRoles = ['showTitle','sceneTitle','categoryHeader','xpValue','question','answer','score','participantName','timer','lowerThird','caption','credits','customMessage'] as const;
const typeShape = Object.fromEntries(typeRoles.map(key => [key, typographySchema])) as Record<typeof typeRoles[number], typeof typographySchema>;

export const themeConfigSchema = z.object({
  compatibilityVersion: z.literal(1),
  metadata: z.object({ name: safeText, description: z.string().max(500), thumbnailAssetId: assetId, defaultProfileId: z.string().max(100).nullable(), defaultLayout: z.enum(['full','overlay','scorebug','question','lowerthird']), defaultScene: z.enum(['standby','intro','board','question','answer','scores','d20','intermission','round-transition','winner','final','credits','custom-message']) }),
  global: z.object({ radius: z.number().min(0).max(120), borderWidth: z.number().min(0).max(20), shadow: z.number().min(0).max(100), glow: z.number().min(0).max(100), motion: z.number().min(0).max(1), contentScale: z.number().min(.5).max(1.5), opacity, pagePadding: px.max(300), scenePadding: px.max(300), sectionGap: px.max(200), panelPadding: px.max(200), gridGap: px.max(100) }),
  branding: z.object({ logoAssetId: assetId, watermarkAssetId: assetId, sponsorAssetId: assetId, logoSize: px.max(800), watermarkSize: px.max(800), showLogo: z.boolean(), showWatermark: z.boolean() }),
  colors: z.object(colorShape), typography: z.object(typeShape),
  background: backgroundSchema, panels: z.object({ default: panelSchema, board: panelSchema, question: panelSchema, answer: panelSchema, scoreboard: panelSchema, lowerThird: panelSchema }),
  board: z.object({ container: elementSchema, gridGap: px.max(100), outerPadding: px.max(200), cellHeight: px.max(400), columnWidth: px.max(800), categoryHeight: px.max(300), categoryMaxLines: z.number().int().min(1).max(4), cellRadius: z.number().min(0).max(100), shape: z.enum(['rectangle','rounded','pill','hex']), usedText: safeText, fourColumnScale: z.number().min(.5).max(1.5), fiveColumnScale: z.number().min(.5).max(1.5), revealAnimation: z.enum(['none','fade','cascade','flip','slide']) }),
  question: z.object({ card: elementSchema, width: percent, height: percent, categoryPlacement: z.enum(['top','inside','hidden']), xpPlacement: z.enum(['top','corner','footer','hidden']), timerPlacement: z.enum(['top','corner','footer','outside']), modifierPlacement: z.enum(['top','bottom','side']), responderIndicator: z.boolean(), verticalAlign: z.enum(['top','center','bottom']), longCopy: z.enum(['shrink','scroll','paginate']), entrance: z.enum(['cut','fade','slide','zoom','reveal']), exit: z.enum(['cut','fade','slide','zoom']) }),
  answer: z.object({ card: elementSchema, showQuestion: z.boolean(), label: safeText, transition: z.enum(['cut','fade','flip','wipe','reveal']), celebrationIntensity: z.number().min(0).max(1), showAwardedParticipant: z.boolean(), showScoreDelta: z.boolean(), showModifier: z.boolean() }),
  scoreboard: z.object({ element: elementSchema, mode: z.enum(['horizontal','vertical','grid','podium','compact']), columns: z.number().int().min(1).max(8), maxParticipants: z.number().int().min(2).max(8), showRank: z.boolean(), showAvatar: z.boolean(), showTeamColor: z.boolean(), animateChanges: z.boolean(), eightPlayerScale: z.number().min(.4).max(1) }),
  timer: z.object({ element: elementSchema, style: z.enum(['digital','circular','horizontal-bar','vertical-bar','minimal','segmented']), size: px.max(800), warningSeconds: z.number().min(1).max(600), criticalSeconds: z.number().min(0).max(300), pulse: z.boolean(), soundCue: z.string().max(80).nullable() }),
  d20: z.object({ element: elementSchema, theme: z.enum(['neon_arcane','classic_polyhedral','holographic_scifi']), size: px.max(1000), surface: hex, edges: hex, numbers: hex, glow: z.number().min(0).max(100), animationMs: z.number().min(0).max(10000), rotation: z.number().min(0).max(2), landingScale: z.number().min(.5).max(2), reducedMotion: z.enum(['cut','fade','scale']) }),
  lowerThirds: z.object({ element: elementSchema, width: percent, height: percent, accent: hex, entrance: z.enum(['cut','fade','slide-left','slide-right','slide-up']), exit: z.enum(['cut','fade','slide-left','slide-right','slide-down']), durationMs: z.number().min(1000).max(60000), transparency: opacity }),
  transitions: z.object({ defaultKind: z.enum(['cut','fade','crossfade','slide-left','slide-right','slide-up','zoom','wipe','glitch','iris']), durationMs: z.number().min(0).max(5000), easing: z.enum(['linear','ease','ease-in','ease-out','ease-in-out']), reducedMotionFallback: z.enum(['cut','fade']) }),
  scenes: z.record(z.string().max(40), z.object({ inherit: z.boolean(), background: backgroundSchema.optional(), positions: z.record(z.string().max(40), positionSchema).default({}) })).default({}),
  layouts: z.object({ full: z.object({ transparent: z.literal(false), positions: z.record(z.string(), positionSchema) }), overlay: z.object({ transparent: z.literal(true), positions: z.record(z.string(), positionSchema) }), scorebug: z.object({ transparent: z.literal(true), positions: z.record(z.string(), positionSchema) }), question: z.object({ transparent: z.literal(true), positions: z.record(z.string(), positionSchema) }), lowerthird: z.object({ transparent: z.literal(true), positions: z.record(z.string(), positionSchema) }) }),
  safeAreas: z.object({ titleSafePercent: percent.max(25), actionSafePercent: percent.max(20), cameraZones: z.array(z.object({ id: z.string().max(40), x: percent, y: percent, width: percent, height: percent })).max(12) }),
  accessibility: z.object({ reducedMotionFallback: z.boolean(), highContrastFallback: z.boolean(), minimumTextSize: z.number().min(8).max(32), announceWarnings: z.boolean() }),
  assetReferences: z.array(z.object({ assetId: z.string().uuid(), role: z.enum(['logo','background','texture','icon','video','audio','font','sponsor']) })).max(100),
}).strict();

export type ThemeConfig = z.infer<typeof themeConfigSchema>;
export type ThemePosition = z.infer<typeof positionSchema>;

const position = (x:number,y:number,width:number,height:number,zIndex=10):ThemePosition => ({ x,y,width,height,anchor:'center',locked:false,hidden:false,zIndex });
const solid = (color:string) => ({ type:'solid' as const,color,opacity:1 });
const panel = (backgroundColor:string,accent:string) => ({ preset:'broadcast' as const,background:solid(backgroundColor),borderColor:accent,borderWidth:1,borderStyle:'solid' as const,radius:18,shadow:38,glow:18,backdropBlur:0,padding:24,opacity:1,accentStripe:true,decorativePattern:'none' as const,headerTreatment:'plain' as const,footerTreatment:'plain' as const });
const typography = (fontFamily:string,size:number,color:string,weight=700) => ({ fontFamily,fallback:'system-ui, sans-serif',weight,style:'normal' as const,size,minSize:14,maxSize:240,lineHeight:1.1,letterSpacing:0,transform:'none' as const,align:'center' as const,color,shadow:2,outline:0,maxLines:6,autoFit:true,overflow:'shrink' as const });
const element = (pos:ThemePosition,bg:string,accent:string) => ({ position:pos,panel:panel(bg,accent),transition:'fade' as const });

export function defaultThemeConfig(name='Nerd Wars Custom'):ThemeConfig {
  const colors={primary:'#7c3aed',secondary:'#06b6d4',accent:'#facc15',background:'#070712',surface:'#17152a',elevatedSurface:'#24213b',text:'#f8fafc',mutedText:'#a5b4c8',border:'#6d5bd0',success:'#22c55e',warning:'#f59e0b',error:'#ef4444',leader:'#facc15',tie:'#38bdf8',completed:'#334155',skipped:'#475569',selected:'#c084fc',disabled:'#64748b',timerNormal:'#f8fafc',timerWarning:'#f59e0b',timerExpired:'#ef4444',natural1:'#ef4444',natural20:'#22c55e'};
  const fonts=Object.fromEntries(typeRoles.map(role=>[role,typography(role==='showTitle'?'Impact, sans-serif':'system-ui, sans-serif',role==='question'?64:role==='timer'?72:role==='score'?38:42,colors.text,role==='caption'?500:800)])) as ThemeConfig['typography'];
  const positions={logo:position(8,8,12,10,30),board:position(5,15,90,70),question:position(10,16,80,66),timer:position(84,7,10,12,40),scoreboard:position(5,86,90,10,20),d20:position(35,15,30,55,50),lowerThird:position(6,78,55,14,60),watermark:position(88,88,8,8,70)};
  return themeConfigSchema.parse({compatibilityVersion:1,metadata:{name,description:'Editable broadcast theme.',thumbnailAssetId:null,defaultProfileId:null,defaultLayout:'full',defaultScene:'board'},global:{radius:18,borderWidth:1,shadow:38,glow:18,motion:.75,contentScale:1,opacity:1,pagePadding:48,scenePadding:48,sectionGap:24,panelPadding:24,gridGap:14},branding:{logoAssetId:null,watermarkAssetId:null,sponsorAssetId:null,logoSize:180,watermarkSize:120,showLogo:true,showWatermark:true},colors,typography:fonts,background:solid(colors.background),panels:{default:panel(colors.surface,colors.border),board:panel(colors.surface,colors.border),question:panel(colors.surface,colors.primary),answer:panel(colors.surface,colors.success),scoreboard:panel(colors.surface,colors.accent),lowerThird:panel(colors.surface,colors.secondary)},board:{container:element(positions.board,colors.surface,colors.border),gridGap:14,outerPadding:20,cellHeight:112,columnWidth:320,categoryHeight:92,categoryMaxLines:2,cellRadius:16,shape:'rounded',usedText:'DONE',fourColumnScale:1,fiveColumnScale:.92,revealAnimation:'cascade'},question:{card:element(positions.question,colors.surface,colors.primary),width:80,height:66,categoryPlacement:'top',xpPlacement:'top',timerPlacement:'corner',modifierPlacement:'bottom',responderIndicator:true,verticalAlign:'center',longCopy:'shrink',entrance:'reveal',exit:'fade'},answer:{card:element(positions.question,colors.surface,colors.success),showQuestion:true,label:'Correct answer',transition:'reveal',celebrationIntensity:.7,showAwardedParticipant:true,showScoreDelta:true,showModifier:true},scoreboard:{element:element(positions.scoreboard,colors.surface,colors.accent),mode:'horizontal',columns:4,maxParticipants:8,showRank:true,showAvatar:false,showTeamColor:true,animateChanges:true,eightPlayerScale:.8},timer:{element:element(positions.timer,colors.surface,colors.warning),style:'digital',size:120,warningSeconds:10,criticalSeconds:5,pulse:true,soundCue:'timer-warning'},d20:{element:element(positions.d20,colors.surface,colors.accent),theme:'neon_arcane',size:420,surface:colors.primary,edges:colors.accent,numbers:colors.text,glow:50,animationMs:2600,rotation:1,landingScale:1.08,reducedMotion:'scale'},lowerThirds:{element:element(positions.lowerThird,colors.surface,colors.secondary),width:55,height:14,accent:colors.secondary,entrance:'slide-left',exit:'slide-left',durationMs:8000,transparency:.96},transitions:{defaultKind:'fade',durationMs:650,easing:'ease-out',reducedMotionFallback:'cut'},scenes:{},layouts:{full:{transparent:false,positions},overlay:{transparent:true,positions},scorebug:{transparent:true,positions},question:{transparent:true,positions},lowerthird:{transparent:true,positions}},safeAreas:{titleSafePercent:10,actionSafePercent:5,cameraZones:[]},accessibility:{reducedMotionFallback:true,highContrastFallback:false,minimumTextSize:14,announceWarnings:true},assetReferences:[]});
}

export function themeCssVariables(config:ThemeConfig):Record<string,string>{
  const c=config.colors,t=config.typography;
  return {'--primary':c.primary,'--secondary':c.secondary,'--background':c.background,'--surface':c.surface,'--accent':c.accent,'--text':c.text,'--muted':c.mutedText,'--success':c.success,'--warning':c.warning,'--error':c.error,'--font-display':t.showTitle.fontFamily,'--font-heading':t.sceneTitle.fontFamily,'--font-body':t.caption.fontFamily,'--font-score':t.score.fontFamily,'--font-timer':t.timer.fontFamily,'--font-question':t.question.fontFamily,'--radius':`${config.global.radius}px`,'--board-gap':`${config.board.gridGap}px`,'--board-cell-radius':`${config.board.cellRadius}px`,'--question-size':`${t.question.size}px`,'--answer-size':`${t.answer.size}px`,'--timer-size':`${t.timer.size}px`,'--content-scale':String(config.global.contentScale)};
}
