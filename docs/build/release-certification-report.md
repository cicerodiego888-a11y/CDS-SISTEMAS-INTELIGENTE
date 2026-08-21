# Release Certification Report — RC4.32.0

## Ambiente

- Versão: 1.0.3
- Commit: 033889f
- Build: 2026-08-21T15:47:25.615Z
- Hash app.asar: `ccb79b55b4563cab80fcc3cded674248b30301d557f77c73b47eddab187ddbe4`
- Origem: instalador-desatualizado
- Data: 2026-08-21T18:09:24.445Z

## Resultados

✔ Inicialização do ERP
  - DB ok | pacote: instalador-desatualizado | asar: ccb79b55b456…
✔ Login
  - user=rc4320_1787335763661 perfil=SUPER_ADMIN
✔ Cadastro de Produtos
  - CRUD ok | embalagem CX×12 | codigo=RC4320-1787335762274-P
✔ Compras
  - NF-e …00000064 | status=EM_REVISAO
✔ Financeiro
  - parser financeiro OK | parcela R$500 | registros financeiro=2
✔ Estoque
  - fiscal=6+3 | total=15 UN
✔ MIIP
  - MUC 10×12 → 120 UN (MULTIPLICADOR)
✔ Central Inteligente
  - documento 000064 processado
✔ NFC-e
  - homologação dest.xNome + módulo emissor presente
✔ NF-e
  - autorização cStat=100 | protocolo=123
✔ Relatórios
  - compras=0 fin=2 prod=700
✔ Performance
  - 2.2s | mem 27.2MB | sql=16

## Estatísticas

- Tempo total: 2.2s
- Memória máxima: 27.2 MB
- CPU user: 1437 ms
- Testes/etapas: 12
- Exceções: 0
- Consultas SQL: 16
- Cobertura funcional: 100%

## Status da Release

**APROVADA**
