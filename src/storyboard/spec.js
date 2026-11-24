// The written animation detail of each panel: what happens, then every track
// with its timing, ease and values, read from the current cut (so it matches the
// film as it is edited). Italian, the way it would go next to a storyboard frame.

import { PALETTE } from './v2/project.js'

const s = (v) => `${Number(v).toFixed(2).replace('.', ',')} s`
const n = (v, d = 2) => Number(v).toFixed(d).replace('.', ',').replace(/,?0+$/, '') || '0'
const pc = (v) => `${Math.round(v * 100)}%`
const COLOR = { violet: 'viola', lavender: 'lilla', ink: 'nero', white: 'bianco', paper: 'carta', lime: 'lime', orange: 'arancio' }
const col = (c) => COLOR[c] || (PALETTE[c] ? c : String(c))

/** → { what, steps: [string] } for a panel id. */
export function specOf(id, T) {
  const sh = (x) => T.shot(x).p
  const wall = T.scene('wall').p
  const ph = T.scene('phone').p
  const road = T.scene('roadmap').p
  const dur = (x) => T.shot(x).dur
  switch (id) {
    case 'open': {
      const p = sh('open')
      return {
        what: 'Su bianco, il primo video (Nicole Pieretto) cresce da una card piccola a quasi tutto schermo.',
        steps: [
          `Video · scala ${n(p.from)} → 1 · ${s(p.scaleDur)} · ${p.scaleEase}`,
          `Immagine interna · parallasse ${n(p.parallax)}: cresce meno della cornice (zoom inverso), così si apre come una finestra`,
          `Cornice · margine bianco ${pc(p.margin)} · angoli ${pc(p.radius)} della larghezza`,
          'Camera ferma · sfondo #FFFFFF · il video resta com’è (niente luce, grana o sfocatura)',
        ],
      }
    }
    case 'stat-2': {
      const p = sh('stat-2')
      return {
        what: `La camera arretra e il «${p.value}» entra con uno zoom out, coprendo il bordo basso del video; Instagram e TikTok ai lati.`,
        steps: [
          `Camera · zoom out · ${s(p.cameraDur)} · ${p.cameraEase} · il video passa da quasi tutto schermo a circa il 60% dell’altezza`,
          `Numero · scala ${n(p.zoomFrom)}× → 1× · opacità 0 → 1 nel primo 40% · ${s(p.zoomDur)} · ${p.zoomEase} · ${col(p.color)}, peso ${p.weight}, piatto`,
          `Icone 3D Instagram + TikTok · colori originali · scala 0 → 1 · 0,80 s · power3.out · stagger 0,12 s · poi oscillano piano (Y ±30°)`,
          `Sottotitolo «${p.label}» · sale da una maschera · 0,70 s · power3.out · ritardo 0,25 s`,
        ],
      }
    }
    case 'stat-3':
    case 'stat-175': {
      const p = sh(id)
      const isRow = id === 'stat-175'
      return {
        what: isRow ? 'Tutta la riga si apre e comincia a girare: è l’equatore della sfera che sta per formarsi.' : 'Due video escono da dietro il primo, a sinistra e a destra; il numero cambia come una ruota.',
        steps: [
          isRow
            ? `Card · si aprono una da dietro l’altra, dal centro ai lati · ${s(p.videoDur)} ciascuna · stagger ${s((p.videoDur * p.videoStagger) / 6)} · ${p.videoEase}`
            : `Video laterali · scivolano fuori da dietro il primo · ${s(p.videoDur)} · ${p.videoEase}`,
          isRow ? `Rotazione · parte ferma, accelera in 1,10 s (smoothstep), poi ${n(wall.speed)} unità/s costanti` : null,
          `Numero «${p.value}» · ruota come un tamburo sull’asse ${p.axis.toUpperCase()} · ${p.angle}° · ${s(p.rollDur)} · ${p.rollEase} · stagger cifre ${s(p.digitStagger)} · le cifre salgono dalla linea di base (maschera)`,
          `Sottotitolo «${p.label}» · il vecchio esce in alto (0,42 s, power3.in), il nuovo sale (0,62 s, power3.out)`,
          `Camera · arretra ancora · ${s(p.cameraDur)} · ${p.cameraEase}`,
        ].filter(Boolean),
      }
    }
    case 'stat-394': {
      const p = sh('stat-394')
      return {
        what: 'Le altre righe crescono dalla sfera, dal centro verso l’esterno; righe alternate.',
        steps: [
          `Righe · ogni card cresce dalla superficie (scala 0 → 1) · ${s(p.videoDur * 0.8)} · power3.out · stagger per distanza dal centro (${s(p.videoDur * p.videoStagger * 1.6)} in tutto)`,
          `Rotazione · righe alternate, una verso destra e una verso sinistra · ${n(wall.speed)} unità/s`,
          `Sfera · ${wall.rows} righe · raggio ${n(wall.radius)} · spazio tra i video ${n(wall.gap)} · angoli ${n(wall.corner)}`,
          `Camera · zoom out sulla sfera · ${s(p.cameraDur)} · ${p.cameraEase}`,
          'Uscita del numero (inizio pila) · ruota su Y fino a 86° (mai di spalle) · scala 1 → 0,35 · dissolvenza · 0,60 s · power3.in',
        ],
      }
    }
    case 'stack': {
      const p = sh('stack')
      const D = dur('stack')
      const K = Math.round(p.cards)
      return {
        what: 'In ordine: le altre righe rientrano, la riga si raccoglie in una pila, la pila diventa lo schermo del telefono.',
        steps: [
          `Righe · rientrano nella sfera dalle più esterne · ${s(D * p.retract)} ciascuna · power3.in · stagger ${s(D * 0.14)}`,
          'Rotazione · frena e si ferma esattamente su una card (mai all’indietro)',
          `Camera · si avvicina alla riga · ${s(D * 0.5)} · power2.inOut`,
          `Card · ${2 * K} card scivolano al centro una sull’altra, alternando destra e sinistra · ${s(D * p.slide)} ciascuna · ${p.slideEase} · passano davanti, non attraversano le altre`,
          `Pila · cresce fino allo schermo del telefono mentre la camera torna indietro · ${s(D * 0.36)} · ${p.growEase} · in cima Marta Carruozzo (non il primo video)`,
        ],
      }
    }
    case 'phone': {
      const p = sh('phone')
      return {
        what: `Il telefono si forma subito attorno alla card; «${p.left}» e «${p.right}» entrano ed escono lettera per lettera; poi il telefono va a destra.`,
        steps: [
          `iPhone · la scocca cresce da sotto il vetro · ${s(p.appearDur)} · ${p.appearEase} · la notch arriva dopo ${s(p.appearDur * 0.45)}`,
          `Testi · peso ${p.weight} · ${col(p.color)} · per ${p.split === 'words' ? 'parole' : 'lettere'} · ai lati del telefono (nei formati verticali: sopra a sinistra e sotto a destra)`,
          `Reveal · da ${s(p.inAt)} · ogni lettera sale da una maschera · ${s(p.charDur)} · stagger ${s(p.charStagger)} · ${p.inEase}`,
          `Unreveal · ${s(p.outLead)} prima della fine · le lettere escono in alto · ${s(p.outDur)} · stagger ${s(p.outStagger)} · ${p.outEase}`,
          `Verso destra · ${s(p.moveDur)} · ${p.moveEase} · tilt X ${p.tiltX}° · Y ${p.tiltY}° · Z ${p.tiltZ}°`,
        ],
      }
    }
    case 'views': {
      const v = sh('view-70m')
      return {
        what: 'Numeri a sinistra, telefono a destra con il feed che scorre; luce dalla finestra e pulviscolo.',
        steps: [
          `Numeri · entrano dal basso e spingono su i precedenti · ${s(v.enterDur)} · ${v.enterEase} · cifre a rullo, stagger ${s(v.charStagger)} · ${col(v.color)} su bianco`,
          `Feed · uno swipe ogni ${s(ph.swipeEvery)} · ${s(ph.swipeDur)} · ${ph.swipeEase}`,
          `Luce · due fasci dalla finestra in alto a sinistra · intensità ${n(ph.rays)} · ombra della stanza ${n(ph.raysShade)} · movimento ${n(ph.raysSway)} · entra in 0,90 s ed esce in 0,70 s (power2.inOut)`,
          `Pulviscolo · particelle calde, si accendono solo dentro i fasci · quantità ${n(ph.dust)} · dimensione ${n(ph.dustSize)} · movimento ${n(ph.dustDrift)}`,
          `Uscita · i numeri escono in alto · ${s(ph.exitDur)} · stagger ${s(ph.exitStagger)} · ${ph.exitEase}`,
        ],
      }
    }
    case 'notifs': {
      const p = sh('notifs')
      return {
        what: 'Il telefono viene davanti alla camera, si vede la notch; i commenti arrivano come notifiche iOS mentre la camera si avvicina.',
        steps: [
          `iPhone davanti · ${s(p.frontDur)} · ${p.frontEase} · largo ${pc(p.phoneFill)} del frame, spostato in basso`,
          'Blocco schermo · ora e data compaiono mentre l’interfaccia social sparisce · lo sfondo è il video, nitido',
          `Notifiche · ${p.count}, una ogni ${s(p.every)} · ${s(p.popDur)} · ${p.popEase} · scala 0,9 → 1 e scendono un poco · il vetro smerigliato si forma con la card (niente sfocatura sul testo)`,
          `Camera · si avvicina fino a ${n(p.zoomTo)}× · ${p.zoomEase} · scende per tenere in vista l’ultima notifica`,
        ],
      }
    }
    case 'dive': {
      const p = sh('dive')
      return {
        what: 'Il tuffo: si entra nello schermo e i commenti corrono verso l’alto, tanti, poi spariscono sfocati.',
        steps: [
          `Zoom · dentro lo schermo fino a ${n(p.zoom)}× (il telefono esce dall’inquadratura) · ${p.zoomEase}`,
          `Commenti · altri ${p.extra} in corsa · accelerano verso l’alto · ${p.speedEase} · motion blur ${n(p.blur)} (frena alla fine: il titolo arriva nitido)`,
          'Telefono · si dissolve mentre si entra nello schermo',
          `Uscita · dissolvenza sfocata dal ${pc(p.fadeFrom)} del blocco · sfocatura ${n(p.fadeBlur)}`,
        ],
      }
    }
    case 'headline': {
      const p = sh('headline')
      return {
        what: 'Il titolo arriva dal basso mentre la camera scende ancora, parola per parola, e se ne va per righe.',
        steps: [
          `Testo · «${p.caps ? String(p.text).toLocaleUpperCase('it-IT') : p.text}» · ${p.caps ? 'tutto maiuscolo · ' : ''}peso ${p.weight} (semibold) · spaziatura ${n(p.tracking, 3)}`,
          `Ingresso · per ${p.split === 'chars' ? 'lettere' : p.split === 'lines' ? 'righe' : 'parole'} · ${s(p.lead)} prima del blocco · tilt X ${p.tilt}° → 0° · sale di ${n(p.rise)} altezze · ${s(p.inDur)} · stagger ${s(p.stagger)} · ${p.inEase}`,
          `Colore · da ${col(p.fromColor)} trasparente a ${col(p.toColor)} pieno`,
          `Uscita · per righe verso l’alto · ${s(p.outDur)} · stagger ${s(p.outStagger)} · ${p.outEase}`,
        ],
      }
    }
    case 'campaigns': {
      const p = sh('campaigns')
      return {
        what: 'Tre campagne al centro: il valore conta da zero, il nome sotto.',
        steps: [
          `Righe · ${p.n1} ${p.v1} · ${p.n2} ${p.v2} · ${p.n3} ${p.v3} · valori ${col(p.color)}, peso ${p.weight} · nomi ${col(p.nameColor)}`,
          `Ingresso · ogni riga sale · ${s(p.riseDur)} · ${p.riseEase} · stagger ${s(p.stagger)} dall’alto in basso`,
          `Contatore · da 0 al valore · ${s(p.countDur)} · ${p.countEase} · cifre a larghezza fissa (il numero non balla), le cifre che non servono ancora restano vuote`,
          `Uscita · verso sinistra · ${s(p.outDur)} · stagger ${s(p.outStagger)} · ${p.outEase}`,
        ],
      }
    }
    case 'pin-aria': {
      const p = sh('pin-aria')
      return {
        what: `Il bianco diventa lilla, la linea entra da sinistra e arriva alla prima tappa: ${p.name}.`,
        steps: [
          `Colore · lilla da destra · ${s(road.wipeDur)} · ${road.wipeEase} · mentre le campagne escono a sinistra`,
          'Linea · entra dal bordo sinistro dello schermo fino alla tappa · 0,70 s · power2.inOut',
          `Tappa · nodo sulla linea 0,22 s → gambo che cresce dalla linea 0,24 s → cerchio disegnato in due metà, dal gambo verso l’alto · ${s(p.drawDur)} · ${p.drawEase}`,
          'Video · si apre dal centro (iride), l’immagine ferma · 0,50 s · power3.out',
          `Testi · «${p.name}», «${p.count}», «${p.date}» salgono · 0,60 s · power3.out · stagger 0,08 s`,
        ],
      }
    }
    case 'pins-mid': {
      const a = sh('pin-gioia')
      return {
        what: 'La camera viaggia con la linea alle tappe successive; a ogni tappa la stessa sequenza, poi un attimo per leggere.',
        steps: [
          `Camera · verso destra con la linea · ${s(dur('pin-gioia') * a.travel)} · ${a.travelEase} · la linea anticipa la camera di 0,06 s`,
          `Tappa · nodo → gambo → cerchio (${s(a.drawDur)}, ${a.drawEase}) → video → testi`,
          'Lettura · il resto del blocco resta fermo',
          `Linea · spessore ${n(road.lineWeight)} · ${col(road.lineColor)} · testi ${col(road.textColor)} · cerchi scala ${n(road.pinSize)}`,
        ],
      }
    }
    case 'pins-logo': {
      const u = sh('pin-uwc')
      const x = sh('pin-natale')
      return {
        what: 'Le due campagne che arriveranno: al posto del video, il logo “c?” di Cooltura in 3D.',
        steps: [
          'Cerchio · si riempie del colore del disco (iride) · 0,50 s · power3.out',
          `Logo “c?” 3D · ${n(u.spin)} giro in ingresso · 0,80 s · power3.out · poi oscilla piano · spessore ${n(u.logoDepth)}`,
          `${u.name} · disco ${col(u.discColor)}, logo ${col(u.logoColor)} · ${x.name} · disco ${col(x.discColor)}, logo ${col(x.logoColor)}`,
        ],
      }
    }
    case 'signoff': {
      const p = sh('signoff')
      return {
        what: 'Il finale, come nel reel Cooltura: il logotipo esce lettera per lettera e il “?” diventa l’asterisco.',
        steps: [
          `Ritiro · linea, gambi e cerchi si riavvolgono verso l’ultima tappa · ${s(p.undrawDur)} · ${p.undrawEase}`,
          `Sfondo · il lilla torna bianco con un’iride dal centro · da ${s(p.bgFrom)} · ${s(p.bgDur)} · ${p.bgEase}`,
          `Logotipo · le lettere salgono dalla linea di base (maschera) · da ${s(p.riseAt)} · ${s(p.riseDur)} · stagger ${s(p.riseStagger)} · ${p.riseEase} · ${col(p.wordColor)}`,
          `Asterisco · il “?” lascia l’ultimo cerchio, gira ${n(p.starSpin)} volta, diventa “*” quando è di taglio e si aggancia a destra · da ${s(p.dockAt)} · ${s(p.dockDur)} · ${p.dockEase}`,
        ],
      }
    }
  }
  return { what: '', steps: [] }
}
