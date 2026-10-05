import { Controller, Get, INestApplication } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import request from 'supertest';
import { DomainError } from '../../src/notification/domain/domain.error';
import { DomainErrorFilter } from '../../src/notification/presentation/domain-error.filter';

@Controller()
class FakeController {
  @Get('domain')
  domain() {
    throw new DomainError('Invalid device token');
  }

  @Get('crash')
  crash() {
    throw new Error('database is down');
  }
}

describe('DomainErrorFilter', () => {
  let app: INestApplication;

  beforeAll(async () => {
    const moduleRef = await Test.createTestingModule({
      controllers: [FakeController],
    }).compile();
    app = moduleRef.createNestApplication({ logger: false });
    app.useGlobalFilters(new DomainErrorFilter());
    await app.init();
  });

  afterAll(async () => {
    await app.close();
  });

  it('turns a DomainError into 400 with its message', async () => {
    const res = await request(app.getHttpServer()).get('/domain');
    expect(res.status).toBe(400);
    expect(res.body.message).toBe('Invalid device token');
  });

  it('leaves other errors alone, so they stay 500', async () => {
    const res = await request(app.getHttpServer()).get('/crash');
    expect(res.status).toBe(500);
    expect(res.body.message).not.toContain('database');
  });
});
