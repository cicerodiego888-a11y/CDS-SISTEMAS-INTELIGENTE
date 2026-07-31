/**
 * Sprint 14.7 — UploadPluOperation (Operation Engine)
 */

'use strict';

const ToledoOperation = require('../operations/ToledoOperation');
const { OperationError, CODES } = require('../operations/OperationErrors');
const pluBuilder = require('./ToledoPluBuilder');
const pluParser = require('./ToledoPluParser');

class UploadPluOperation extends ToledoOperation {
  static get OPERATION() { return 'UPLOAD_PLU'; }

  constructor(opcoes = {}) {
    super({
      ...opcoes,
      operation: 'UPLOAD_PLU',
      timeout: opcoes.timeout != null ? opcoes.timeout : 5000
    });
    this.plu = opcoes.plu || null;
    this.frame = opcoes.frame || null;
  }

  async run(ctx) {
    if (!ctx.driver) {
      throw OperationError.fromCode(CODES.CONNECTION_LOST, 'Driver ausente');
    }
    const frame = this.frame || pluBuilder.build(this.plu);
    this.bytesSent = frame.length;
    await ctx.driver.sendFrame(frame);
    const raw = await ctx.driver.receiveFrame({ timeoutMs: this.timeout });
    this.bytesReceived = raw && raw.length ? raw.length : 0;
    const ack = pluParser.assertAck(raw);
    return {
      ok: true,
      ack: true,
      plu: this.plu ? this.plu.plu : null,
      payload: ack.payload
    };
  }
}

module.exports = UploadPluOperation;
module.exports.UploadPluOperation = UploadPluOperation;
