# Release Certification Report — RC4.32.0

## Ambiente

- Versão: 1.0.3
- Commit: 51caa1f
- Build: 2026-08-01T17:56:22.279Z
- Hash app.asar: `79223abf8775e590645c980a97ea3d8ba8bee2b58fc1e3b2381b85c8948a1744`
- Origem: fonte
- Data: 2026-08-01T18:51:32.219Z

## Resultados

✔ Inicialização do ERP
  - DB ok | pacote: fonte | asar: N/A…
✔ Login
  - user=rc4320_1785610291637 perfil=SUPER_ADMIN
✔ Cadastro de Produtos
  - CRUD ok | embalagem CX×12 | codigo=RC4320-1785610290947-P
✔ Compras
  - NF-e …00000064 | status=EM_REVISAO
✔ Financeiro
  - parser financeiro OK | parcela R$500 | registros financeiro=49
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
  - compras=1 fin=49 prod=1268
✔ Performance
  - 1.3s | mem 21.1MB | sql=16

## Estatísticas

- Tempo total: 1.3s
- Memória máxima: 21.1 MB
- CPU user: 688 ms
- Testes/etapas: 12
- Exceções: 0
- Consultas SQL: 16
- Cobertura funcional: 100%

## Status da Release

**APROVADA**
