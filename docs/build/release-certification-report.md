# Release Certification Report — RC4.32.0

## Ambiente

- Versão: 1.0.3
- Commit: desconhecido
- Build: 2026-08-21T13:19:19.332Z
- Hash app.asar: `f132d9f24093d830ee78a018887b5f924d7e12b91473a683d4a37d417a62f502`
- Origem: fonte
- Data: 2026-08-21T14:08:22.262Z

## Resultados

✔ Inicialização do ERP
  - DB ok | pacote: fonte | asar: N/A…
✔ Login
  - user=rc4320_1787321300593 perfil=SUPER_ADMIN
✔ Cadastro de Produtos
  - CRUD ok | embalagem CX×12 | codigo=RC4320-1787321299620-P
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
  - compras=0 fin=2 prod=691
✔ Performance
  - 2.6s | mem 24.8MB | sql=16

## Estatísticas

- Tempo total: 2.6s
- Memória máxima: 24.8 MB
- CPU user: 1922 ms
- Testes/etapas: 12
- Exceções: 0
- Consultas SQL: 16
- Cobertura funcional: 100%

## Status da Release

**APROVADA**
