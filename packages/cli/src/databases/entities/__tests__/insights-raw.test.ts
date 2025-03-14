import { Container } from '@n8n/di';
import { DateTime } from 'luxon';

import { InsightsRawRepository } from '@/databases/repositories/insights-raw.repository';
import { sql } from '@/insights/insights.module';
import { createMetadata, createRawInsightsEvent } from '@test-integration/db/insights';
import { createTeamProject } from '@test-integration/db/projects';
import { createWorkflow } from '@test-integration/db/workflows';

import * as testDb from '../../../../test/integration/shared/test-db';
import { InsightsRaw } from '../insights-raw';
import type { TypeUnits } from '../insights-shared';

let insightsRawRepository: InsightsRawRepository;

beforeAll(async () => {
	await testDb.init();
	insightsRawRepository = Container.get(InsightsRawRepository);
});

beforeEach(async () => {
	await testDb.truncate(['InsightsRaw']);
});

afterAll(async () => {
	await testDb.terminate();
});

describe('Insights Raw Entity', () => {
	test.each(['success', 'failure', 'runtime_ms', 'time_saved_min'] satisfies TypeUnits[])(
		'`%s` can be serialized and deserialized correctly',
		(typeUnit) => {
			// ARRANGE
			const rawInsight = new InsightsRaw();

			// ACT
			rawInsight.type = typeUnit;

			// ASSERT
			expect(rawInsight.type).toBe(typeUnit);
		},
	);

	test('`timestamp` can be serialized and deserialized correctly', () => {
		// ARRANGE
		const rawInsight = new InsightsRaw();
		const now = new Date();

		// ACT

		rawInsight.timestamp = now;

		// ASSERT
		now.setMilliseconds(0);
		expect(rawInsight.timestamp).toEqual(now);
	});

	test('timestamp is stored as timestamp, not as date', async () => {
		// ARRANGE
		const project = await createTeamProject();
		const workflow = await createWorkflow({}, project);
		const now = DateTime.utc().startOf('second');
		await createMetadata(workflow);
		const rawInsight = await createRawInsightsEvent(workflow, {
			type: 'success',
			value: 1,
			timestamp: now,
		});

		// ACT
		await insightsRawRepository.save(rawInsight);

		// ASSERT
		const timestampValue: Array<{ timestamp: number }> = await insightsRawRepository.query(sql`
			SELECT timestamp from insights_raw
		`);
		expect(timestampValue).toHaveLength(1);
		const timestamp = timestampValue[0].timestamp;
		expect(timestamp).toEqual(now.toSeconds());
	});

	test('timestamp uses the correct default value', async () => {
		// ARRANGE
		const project = await createTeamProject();
		const workflow = await createWorkflow({}, project);
		await createMetadata(workflow);
		const rawInsight = await createRawInsightsEvent(workflow, {
			type: 'success',
			value: 1,
		});

		// ACT
		const now = DateTime.utc().startOf('second');
		await insightsRawRepository.save(rawInsight);

		// ASSERT
		const timestampValue: Array<{ timestamp: number }> = await insightsRawRepository.query(sql`
			SELECT timestamp from insights_raw;
		`);
		expect(timestampValue).toHaveLength(1);
		const timestamp = timestampValue[0].timestamp;
		expect(Math.abs(now.toSeconds() - timestamp)).toBeLessThan(1);
	});
});
