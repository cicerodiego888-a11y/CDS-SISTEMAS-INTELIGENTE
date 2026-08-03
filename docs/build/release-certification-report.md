# Release Certification Report — RC4.32.0

## Ambiente

- Versão: 1.0.3
- Commit: 1ffb33d
- Build: 2026-08-02T02:46:58.705Z
- Hash app.asar: `dce88fa6ec7f2e136964168f55bea9f0034565842d919fc2a9f3cce662675264`
- Origem: fonte
- Data: 2026-08-02T16:39:47.602Z

## Resultados

✔ Inicialização do ERP
  - DB ok | pacote: fonte | asar: N/A…
✔ Login
  - user=rc4320_1785688786928 perfil=SUPER_ADMIN
✔ Cadastro de Produtos
  - CRUD ok | embalagem CX×12 | codigo=RC4320-1785688786130-P
✔ Compras
  - NF-e …00000064 | status=EM_REVISAO
✔ Financeiro
  - parser financeiro OK | parcela R$500 | registros financeiro=50
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
  - compras=1 fin=50 prod=1268
✔ Performance
  - 1.5s | mem 21.1MB | sql=16

## Estatísticas

- Tempo total: 1.5s
- Memória máxima: 21.1 MB
- CPU user: 641 ms
- Testes/etapas: 12
- Exceções: 0
- Consultas SQL: 16
- Cobertura funcional: 100%

## Status da Release

**APROVADA**
