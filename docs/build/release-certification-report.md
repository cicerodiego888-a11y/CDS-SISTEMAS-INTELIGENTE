# Release Certification Report — RC4.32.0

## Ambiente

- Versão: 1.0.3
- Commit: bf0ea93
- Build: 2026-09-10T13:50:58.722Z
- Hash app.asar: `aa03a5cf7c8b5b19fa4201504ab58ff5e769bf6b1292f7b9313a56d2f1dba1bd`
- Origem: instalador-desatualizado
- Data: 2026-09-11T14:07:08.332Z

## Resultados

✔ Inicialização do ERP
  - DB ok | pacote: instalador-desatualizado | asar: aa03a5cf7c8b…
✔ Login
  - user=rc4320_1789135626576 perfil=SUPER_ADMIN
✔ Cadastro de Produtos
  - CRUD ok | embalagem CX×12 | codigo=RC4320-1789135624352-P
✔ Compras
  - NF-e …00000064 | status=EM_REVISAO
✔ Financeiro
  - parser financeiro OK | parcela R$500 | registros financeiro=119
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
  - compras=4 fin=119 prod=1637
✔ Performance
  - 4s | mem 28.6MB | sql=16

## Estatísticas

- Tempo total: 4s
- Memória máxima: 28.6 MB
- CPU user: 2531 ms
- Testes/etapas: 12
- Exceções: 0
- Consultas SQL: 16
- Cobertura funcional: 100%

## Status da Release

**APROVADA**
