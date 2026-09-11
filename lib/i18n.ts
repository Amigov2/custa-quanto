// Internationalisation des labels UI. La langue courante vient de lib/ui_lang.
// Les termes techniques SINAPI (Pintura interna, Piso cerâmico...) restent en PT
// car ce sont des standards métier au Brésil, comme  béton armé  en France.
//
// Ajouter une clé : ajoute-la dans PT (référence) puis dans FR/ES/EN.
// Si une clé manque dans une langue → fallback sur PT.

import { getCurrentLang, onLangChange, type LangCode } from "./ui_lang";
import { useEffect, useState } from "react";

type Dict = Record<string, string>;

const PT: Dict = {
  // Home
  "home.title": "Início",
  "home.total": "Total dos seus chantiers",
  "home.chantiers": "chantiers",
  "home.chantier": "chantier",
  "home.saved": "Salvos",
  "home.newRenovation": "Nova reforma",
  "home.newRenovationSub": "Nouveau chantier",
  "home.scopePlaceholder": "Ex: quero pintar minha cozinha de 15 m². Ou tire uma foto e deixe a IA analisar.",
  "home.helper": "Digite, tire uma foto (ou várias), ou os dois. A IA decide o resto.",
  "home.analyze": "Analisar",
  "home.analyzing": "Analisando…",
  "home.chooseManually": "Ou escolher manualmente cômodo/serviço →",
  "home.footer": "Baseado em SINAPI RJ 2025 · 246 notas fiscais reais Rio Centro",
  "home.aprendizados": "🧠 O que a IA aprendeu com você →",
  "home.applyingLearnings": "Aplicando",
  "home.corrections": "correção",
  "home.correctionsPlural": "correções",
  "home.preferences": "preferência",
  "home.preferencesPlural": "preferências",
  "home.aprendidasFinal": "aprendidas",

  // Chantier card
  "card.details": "Detalhes",
  "card.accounts": "Contas",
  "card.delete": "Excluir",
  "card.services": "serviço",
  "card.servicesPlural": "serviços",
  "card.paid": "pago",
  "card.remaining": "restante",
  "card.over": "acima",

  // Nav / commun
  "nav.back": "Início",
  "nav.backLabel": "accueil",
  "common.cancel": "Cancelar",
  "common.save": "Salvar",
  "common.close": "Fechar",
  "common.confirm": "Confirmar",
  "common.edit": "Editar",
  "common.share": "Partilhar",
  "common.print": "Imprimir",
  "common.copy": "Copiar",
  "common.days": "dias",
  "common.day": "dia",
  "common.person": "pessoa",
  "common.persons": "pessoas",
  "common.trocar": "Trocar",

  // Foto page
  "foto.analyze": "Analisar foto",
  "foto.analyzeSub": "Analyser une photo",
  "foto.takePhoto": "Tire uma foto do cômodo",
  "foto.takePhotoSub": "Prends une photo de la pièce",
  "foto.aiHelp": "A IA detecta o que precisa ser feito e sugere o metrage aproximado. Você valida antes de calcular.",
  "foto.openCamera": "Abrir câmera",
  "foto.chooseGallery": "Ou escolher da galeria",
  "foto.chooseGallerySub": "depuis la galerie",
  "foto.lightingTip": "💡 Tire com boa iluminação, mostrando o máximo do cômodo. Inclua uma porta ou móvel se possível — ajuda para estimar tamanho.",
  "foto.drafts": "Rascunhos",
  "foto.draftsSub": "non vinculadas a um chantier",
  "foto.preview": "Preview",
  "foto.forChantier": "Foto para o chantier existente",
  "foto.forChantierSub": "Sera ajoutée à la timeline du chantier",
  "foto.savedDraft": "Salvo em Rascunhos",
  "foto.analyzeAnother": "Analisar outra foto →",
  "foto.responseTitle": "Resposta",
  "foto.itens": "O que precisa ser feito",
  "foto.itensSub": "Ce qu'il faut faire",
  "foto.produtos": "Produtos recomendados",
  "foto.produtosSub": "Produits recommandés",
  "foto.passos": "Como aplicar",
  "foto.passosSub": "Comment appliquer",
  "foto.observacoes": "Observações",
  "foto.observacoesSub": "Remarques",
  "foto.viewAfter": "✨ Ver depois",
  "foto.viewAfterSub": "Preview IA · Voir après reforma",
  "foto.chooseStyle": "Escolha um estilo — a IA gera uma preview do resultado após reforma :",
  "foto.demoMode": "Modo demo · inspiração genérica",
  "foto.changeStyle": "Trocar estilo",
  "foto.generating": "Gerando",
  "foto.wrongType": "Não é isso?",
  "foto.changed": "Alterado ✓",
  "foto.chooseType": "Escolha o tipo correto",
  "foto.chooseTypeSub": "Choisis le bon type",
  "foto.structuralWarning": "Obra estrutural detectada",
  "foto.structuralText": "A IA identificou uma obra que envolve cargas ou pressões críticas (muro de contenção, laje, muro portante...). Consulte um engenheiro estrutural CREA antes de qualquer intervenção. Um laudo custa ~R$ 2.000-4.000 e evita colapsos.",

  // Ambiente labels
  "amb.cozinha": "Cozinha",
  "amb.banheiro": "Banheiro",
  "amb.sala": "Sala",
  "amb.quarto": "Quarto",
  "amb.escritorio": "Escritório",
  "amb.fachada": "Fachada",
  "amb.area_externa": "Área externa",
  "amb.outro": "Ambiente",

  // Estimate
  "est.newChantier": "Novo chantier",
  "est.saveChantier": "Salvar chantier",
  "est.updateChantier": "Atualizar chantier",
  "est.totalLive": "Total live",
  "est.moOnly": "Só mão de obra",
  "est.totalWithBDI": "Total com BDI",
  "est.range": "Faixa",
  "est.material": "Material",
  "est.laborDaily": "Mão de obra (diária)",
  "est.grossLabor": "Mão de obra bruta",
  "est.socialCharges": "Encargos sociais",
  "est.bdi": "BDI empreiteira",
  "est.contingency": "Contingência",
  "est.finalTotal": "Total final",
  "est.compareOrcamento": "Comparar com orçamento recebido",
  "est.yourTeam": "Sua equipe",
  "est.yourTeamSub": "Ton équipe",
  "est.moTotal": "MO total",
  "est.oficiais": "Oficiais",
  "est.ajudantes": "Ajudantes",
  "est.config": "Configuração do devis",
  "est.cronograma": "Cronograma",
  "est.detailPerPoste": "Detalhamento por poste",
  "est.acabamento": "Acabamento global",
  "est.materialList": "Lista de material",
  "est.materialClient": "cliente compra",
  "est.materialContractor": "empreiteiro fornece",
  "est.addService": "Adicionar outro serviço",
  "est.calibration": "Calibrado com SINAPI RJ 2025 + 246 NFs reais Rio Centro. Encargos e BDI aplicados conforme padrão BR (ajustáveis na configuração).",

  // Contas
  "contas.title": "Contas",
  "contas.registerPayment": "Registrar pagamento",
  "contas.paymentsRegistered": "pagamento registrado",
  "contas.paymentsRegisteredPlural": "pagamentos registrados",
  "contas.ofEstimated": "de {total} estimado",
  "contas.byPhase": "Por fase",
  "contas.photos": "Fotos",
  "contas.addFirstPhoto": "Adicionar primeira foto",
  "contas.addPhotoSub": "Documenta o avanço do chantier · La progression du chantier",
  "contas.records": "Registros",
  "contas.noRecords": "Nenhum pagamento registrado ainda. Comece pelo botão abaixo.",
  "contas.finalize": "🎯 Finalizar chantier — quanto pagou vraiment ?",
  "contas.finalized": "Chantier finalizado",
  "contas.finalizedSub": "Sua correção calibra as estimativas futuras",
  "contas.finalizeTitle": "Finalizar chantier",
  "contas.finalizeText": "Sua correção calibra os preços Rio para os próximos chantiers.\nLa correction calibre les prix futurs",
  "contas.paidTotal": "Quanto pagou no total ?",
  "contas.notes": "Notas",
  "contas.notesOptional": "opcional",

  // Aprendizados
  "apr.title": "O que a IA aprendeu",
  "apr.subtitle": "Ce que l'IA a appris de toi",
  "apr.emptyTitle": "Nada aprendido ainda",
  "apr.emptyText": "Comece a corrigir análises, digitar escopos ou finalizar chantiers. A IA vai aprender com suas ações.",
  "apr.corrections": "Correções",
  "apr.chantiersDone": "Chantiers finalizados",
  "apr.preferences": "Preferências detectadas",
  "apr.clearAll": "Limpar tudo",
  "apr.signalsCollected": "sinais coletados · influenciam as futuras análises",

  // Share
  "share.title": "Partilhar orçamento",
  "share.public": "Lien público, sans compte utilisateur",
  "share.copyLink": "Copiar link",
  "share.linkCopied": "✓ Link copiado !",
  "share.shareWA": "Partilhar por WhatsApp",
  "share.shareWASub": "Mensagem pronta + link",
  "share.print": "Imprimir / Salvar PDF",
  "share.printSub": "Exportar em PDF via impressora",
};

const FR: Dict = {
  // Home
  "home.title": "Accueil",
  "home.total": "Total de tes chantiers",
  "home.chantiers": "chantiers",
  "home.chantier": "chantier",
  "home.saved": "Enregistrés",
  "home.newRenovation": "Nouveau chantier",
  "home.newRenovationSub": "Nova reforma",
  "home.scopePlaceholder": "Ex: je veux repeindre ma cuisine de 15 m². Ou prends une photo et laisse l'IA analyser.",
  "home.helper": "Écris, prends une photo (ou plusieurs), ou les deux. L'IA décide du reste.",
  "home.analyze": "Analyser",
  "home.analyzing": "Analyse en cours…",
  "home.chooseManually": "Ou choisir manuellement pièce/service →",
  "home.footer": "Basé sur SINAPI RJ 2025 · 246 factures réelles Rio Centro",
  "home.aprendizados": "🧠 Ce que l'IA a appris de toi →",
  "home.applyingLearnings": "Application de",
  "home.corrections": "correction",
  "home.correctionsPlural": "corrections",
  "home.preferences": "préférence",
  "home.preferencesPlural": "préférences",
  "home.aprendidasFinal": "apprises",

  // Card
  "card.details": "Détails",
  "card.accounts": "Comptes",
  "card.delete": "Supprimer",
  "card.services": "service",
  "card.servicesPlural": "services",
  "card.paid": "payé",
  "card.remaining": "restant",
  "card.over": "au-dessus",

  // Nav / commun
  "nav.back": "Accueil",
  "nav.backLabel": "início",
  "common.cancel": "Annuler",
  "common.save": "Enregistrer",
  "common.close": "Fermer",
  "common.confirm": "Confirmer",
  "common.edit": "Modifier",
  "common.share": "Partager",
  "common.print": "Imprimer",
  "common.copy": "Copier",
  "common.days": "jours",
  "common.day": "jour",
  "common.person": "personne",
  "common.persons": "personnes",
  "common.trocar": "Changer",

  // Foto
  "foto.analyze": "Analyser une photo",
  "foto.analyzeSub": "Analisar foto",
  "foto.takePhoto": "Prends une photo de la pièce",
  "foto.takePhotoSub": "Tire uma foto do cômodo",
  "foto.aiHelp": "L'IA détecte ce qui doit être fait et propose une surface estimée. Tu valides avant de calculer.",
  "foto.openCamera": "Ouvrir la caméra",
  "foto.chooseGallery": "Ou choisir depuis la galerie",
  "foto.chooseGallerySub": "escolher da galeria",
  "foto.lightingTip": "💡 Prends la photo avec une bonne lumière, en montrant le max de la pièce. Inclus une porte ou un meuble si possible — ça aide à estimer la taille.",
  "foto.drafts": "Brouillons",
  "foto.draftsSub": "non rattachés à un chantier",
  "foto.preview": "Aperçu",
  "foto.forChantier": "Photo pour le chantier existant",
  "foto.forChantierSub": "Sera ajoutée à la timeline du chantier",
  "foto.savedDraft": "Enregistré dans les brouillons",
  "foto.analyzeAnother": "Analyser une autre photo →",
  "foto.responseTitle": "Réponse",
  "foto.itens": "Ce qu'il faut faire",
  "foto.itensSub": "O que precisa ser feito",
  "foto.produtos": "Produits recommandés",
  "foto.produtosSub": "Produtos recomendados",
  "foto.passos": "Comment appliquer",
  "foto.passosSub": "Como aplicar",
  "foto.observacoes": "Remarques",
  "foto.observacoesSub": "Observações",
  "foto.viewAfter": "✨ Voir l'après",
  "foto.viewAfterSub": "Preview IA · Après reforma",
  "foto.chooseStyle": "Choisis un style — l'IA génère une preview du résultat après reforma :",
  "foto.demoMode": "Mode démo · inspiration générique",
  "foto.changeStyle": "Changer de style",
  "foto.generating": "Génération",
  "foto.wrongType": "Ce n'est pas ça ?",
  "foto.changed": "Modifié ✓",
  "foto.chooseType": "Choisis le bon type",
  "foto.chooseTypeSub": "Escolha o tipo correto",
  "foto.structuralWarning": "Ouvrage structurel détecté",
  "foto.structuralText": "L'IA a identifié un ouvrage qui implique des charges ou pressions critiques (mur de soutènement, dalle, mur porteur...). Consulte un ingénieur structure CREA avant toute intervention. Un rapport coûte ~R$ 2.000-4.000 et évite des effondrements.",

  // Ambiente
  "amb.cozinha": "Cuisine",
  "amb.banheiro": "Salle de bain",
  "amb.sala": "Salon",
  "amb.quarto": "Chambre",
  "amb.escritorio": "Bureau",
  "amb.fachada": "Façade",
  "amb.area_externa": "Extérieur",
  "amb.outro": "Espace",

  // Estimate
  "est.newChantier": "Nouveau chantier",
  "est.saveChantier": "Enregistrer le chantier",
  "est.updateChantier": "Mettre à jour",
  "est.totalLive": "Total live",
  "est.moOnly": "Main-d'œuvre uniquement",
  "est.totalWithBDI": "Total avec BDI",
  "est.range": "Fourchette",
  "est.material": "Matériel",
  "est.laborDaily": "Main-d'œuvre (journalier)",
  "est.grossLabor": "Main-d'œuvre brute",
  "est.socialCharges": "Charges sociales",
  "est.bdi": "BDI entreprise",
  "est.contingency": "Contingence",
  "est.finalTotal": "Total final",
  "est.compareOrcamento": "Comparer avec un devis reçu",
  "est.yourTeam": "Ton équipe",
  "est.yourTeamSub": "Sua equipe",
  "est.moTotal": "Total MO",
  "est.oficiais": "Ouvriers qualifiés",
  "est.ajudantes": "Aides",
  "est.config": "Configuration du devis",
  "est.cronograma": "Planning",
  "est.detailPerPoste": "Détail par poste",
  "est.acabamento": "Finition globale",
  "est.materialList": "Liste des matériaux",
  "est.materialClient": "client achète",
  "est.materialContractor": "entreprise fournit",
  "est.addService": "Ajouter un autre service",
  "est.calibration": "Calibré avec SINAPI RJ 2025 + 246 factures réelles Rio Centro. Charges et BDI selon standards BR (ajustables dans la config).",

  // Contas
  "contas.title": "Comptes",
  "contas.registerPayment": "Enregistrer un paiement",
  "contas.paymentsRegistered": "paiement enregistré",
  "contas.paymentsRegisteredPlural": "paiements enregistrés",
  "contas.ofEstimated": "de {total} estimé",
  "contas.byPhase": "Par phase",
  "contas.photos": "Photos",
  "contas.addFirstPhoto": "Ajouter la première photo",
  "contas.addPhotoSub": "Documente l'avancement du chantier",
  "contas.records": "Enregistrements",
  "contas.noRecords": "Aucun paiement enregistré. Commence avec le bouton ci-dessous.",
  "contas.finalize": "🎯 Finaliser le chantier — combien tu as payé vraiment ?",
  "contas.finalized": "Chantier finalisé",
  "contas.finalizedSub": "Ta correction calibre les futures estimations",
  "contas.finalizeTitle": "Finaliser le chantier",
  "contas.finalizeText": "Ta correction calibre les prix Rio pour les prochains chantiers.",
  "contas.paidTotal": "Combien as-tu payé au total ?",
  "contas.notes": "Notes",
  "contas.notesOptional": "optionnel",

  // Aprendizados
  "apr.title": "Ce que l'IA a appris",
  "apr.subtitle": "De tes usages et corrections",
  "apr.emptyTitle": "Rien appris pour l'instant",
  "apr.emptyText": "Commence à corriger des analyses, écrire des scopes ou finaliser des chantiers. L'IA apprendra avec tes actions.",
  "apr.corrections": "Corrections",
  "apr.chantiersDone": "Chantiers finalisés",
  "apr.preferences": "Préférences détectées",
  "apr.clearAll": "Tout effacer",
  "apr.signalsCollected": "signaux collectés · influencent les prochaines analyses",

  // Share
  "share.title": "Partager le devis",
  "share.public": "Lien public, sans compte utilisateur",
  "share.copyLink": "Copier le lien",
  "share.linkCopied": "✓ Lien copié !",
  "share.shareWA": "Partager par WhatsApp",
  "share.shareWASub": "Message prêt + lien",
  "share.print": "Imprimer / Sauver en PDF",
  "share.printSub": "Exporter en PDF via imprimante",
};

// Traductions basiques pour ES et EN — pas exhaustives, fallback sur PT si manque.
const ES: Dict = {
  "home.title": "Inicio",
  "home.total": "Total de tus obras",
  "home.saved": "Guardados",
  "home.newRenovation": "Nueva reforma",
  "home.analyze": "Analizar",
  "home.analyzing": "Analizando…",
  "card.details": "Detalles",
  "card.accounts": "Cuentas",
  "card.delete": "Eliminar",
  "common.cancel": "Cancelar",
  "common.save": "Guardar",
  "common.close": "Cerrar",
  "common.share": "Compartir",
  "common.print": "Imprimir",
  "foto.analyze": "Analizar foto",
  "foto.openCamera": "Abrir cámara",
  "est.saveChantier": "Guardar obra",
  "contas.title": "Cuentas",
};

const EN: Dict = {
  "home.title": "Home",
  "home.total": "Total of your projects",
  "home.saved": "Saved",
  "home.newRenovation": "New renovation",
  "home.analyze": "Analyze",
  "home.analyzing": "Analyzing…",
  "card.details": "Details",
  "card.accounts": "Payments",
  "card.delete": "Delete",
  "common.cancel": "Cancel",
  "common.save": "Save",
  "common.close": "Close",
  "common.share": "Share",
  "common.print": "Print",
  "foto.analyze": "Analyze photo",
  "foto.openCamera": "Open camera",
  "est.saveChantier": "Save project",
  "contas.title": "Payments",
};

const DICTS: Record<LangCode, Dict> = {
  pt: PT,
  fr: FR,
  es: ES,
  en: EN,
  zh: {}, // fallback total sur PT
  it: {},
  de: {},
  ja: {},
};

export function t(key: string, lang?: LangCode): string {
  const l = lang || (typeof window !== "undefined" ? getCurrentLang() : "pt");
  return DICTS[l]?.[key] || PT[key] || key;
}

// Hook React — retourne une fonction t liée à la langue courante,
// et se réhydrate quand la langue change (via event bus onLangChange).
export function useT(): (key: string, params?: Record<string, string>) => string {
  const [lang, setLang] = useState<LangCode>("pt");

  useEffect(() => {
    setLang(getCurrentLang());
    return onLangChange(setLang);
  }, []);

  return (key: string, params?: Record<string, string>) => {
    let text = DICTS[lang]?.[key] || PT[key] || key;
    if (params) {
      Object.entries(params).forEach(([k, v]) => {
        text = text.replace(`{${k}}`, v);
      });
    }
    return text;
  };
}
