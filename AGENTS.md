# ScrubsandClubs

Lees README en bestaande projectdocumentatie vóór wijzigingen.
## Gedeeld werkcontract — Claude en Codex

- Voer omkeerbaar intern werk uit wanneer de intentie duidelijk is. Benoem materiële aannames. Vraag verduidelijking wanneer ambiguïteit het resultaat, een commitment, een privacygrens of de kosten verandert. Bestaande expliciete beperkingen voor externe acties blijven gelden.
- Plan substantieel werk eerst; respecteer expliciet gevraagde planreview vóór uitvoering.
- Verifieer wijzigingen met passende checks; meld wat wel en niet getest is.
- Behoud projectspecifieke domeinregels, privacygrenzen en externe toestemmingen.
- Bundel UI-feedback en gebruik de beschikbare visuele controle; veronderstel geen ontbrekende tools.
- AGENTS.md is de gedeelde bron; CLAUDE.md importeert die. Bewaar duurzame projectcontext in repo-documenten, niet uitsluitend in agent-chatgeheugen.
- Nieuwe repo: AGENTS.md met dit contract + CLAUDE.md met @AGENTS.md. Projectspecifieke skills in .agents/skills; voer agent-setup.ps1 uit voor de Claude-verwijzing.
- Bij gelijktijdig werk: controleer git-status, claim een afgebakende taak in een eigen docs/agent-work/<taak>.md wanneer werk over sessies loopt, en gebruik aparte worktrees voor overlappende codewijzigingen. Overschrijf nooit andermans wijzigingen. Lees vlak vóór een edit opnieuw; stop bij een onverwachte wijziging.
- Eindig een overdracht met huidige toestand, verificatie, open punten en volgende actie. Chatgeschiedenis wordt niet automatisch tussen agents gedeeld.

