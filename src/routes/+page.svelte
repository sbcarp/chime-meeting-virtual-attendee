<script lang="ts">
	import { onMount } from 'svelte';
	import { debounce } from 'lodash-es';
	import type { MeetingStatus } from '../lib/types';

	let meetingId: string = '';
	let desiredVideoBots: number = 1;
	let desiredNoneVideoBots: number = 0;
	let enableAudioForFirstBot: boolean = false;

	let meetings: { [key: string]: MeetingStatus } = {};

	const fetchMeetingStatus = async () => {
		const response = await fetch('/api/meeting-status');
		meetings = await response.json();
	};

	const addBots = async () => {
		const meeting = meetings[meetingId];
		await fetch('/api/add-bots', {
			method: 'POST',
			headers: { 'Content-Type': 'application/json' },
			body: JSON.stringify({
				meetingId,
				desiredVideoBots: (meeting?.activeVideoBots ?? 0) + desiredVideoBots,
				desiredNoneVideoBots: (meeting?.activeNoneVideoBots ?? 0) + desiredNoneVideoBots,
				enableAudioForFirstBot
			})
		});

		await fetchMeetingStatus();
	};

	const adjustBots = debounce(
		async (meetingId: string, desiredVideoBots: number, desiredNoneVideoBots: number) => {
			await fetch('/api/adjust-bots', {
				method: 'POST',
				headers: { 'Content-Type': 'application/json' },
				body: JSON.stringify({
					meetingId,
					desiredVideoBots,
					desiredNoneVideoBots
				})
			});
			await fetchMeetingStatus();
		},
		500
	);

	onMount(() => {
		fetchMeetingStatus();
		setInterval(fetchMeetingStatus, 1000); // Polling every second
	});
</script>

<main class="mx-auto max-w-4xl p-6">
	<h1 class="mb-6 text-2xl font-bold">Chime Bot Manager</h1>

	<!-- Form -->
	<form class="mb-6 rounded bg-white px-8 pb-8 pt-6 shadow-md">
		<div class="mb-4">
			<label class="mb-2 block text-sm font-bold text-gray-700" for="meetingId"> Meeting ID </label>
			<input
				class="focus:shadow-outline w-full appearance-none rounded border px-3 py-2 leading-tight text-gray-700 shadow focus:outline-none"
				id="meetingId"
				type="text"
				placeholder="Enter Meeting ID"
				bind:value={meetingId}
			/>
		</div>
		<div class="mb-4">
			<label class="mb-2 block text-sm font-bold text-gray-700" for="desiredVideoBots">
				Number of Video Bots (0-25)
			</label>
			<input
				id="desiredVideoBots"
				type="number"
				min="0"
				max="25"
				class="focus:shadow-outline w-full appearance-none rounded border px-3 py-2 leading-tight text-gray-700 shadow focus:outline-none"
				bind:value={desiredVideoBots}
			/>
		</div>
		<div class="mb-4">
			<label class="mb-2 block text-sm font-bold text-gray-700" for="desiredNoneVideoBots">
				Number of Non-Video Bots (0-25)
			</label>
			<input
				id="desiredNoneVideoBots"
				type="number"
				min="0"
				max="25"
				class="focus:shadow-outline w-full appearance-none rounded border px-3 py-2 leading-tight text-gray-700 shadow focus:outline-none"
				bind:value={desiredNoneVideoBots}
			/>
		</div>
		<div class="mb-4">
			<label class="inline-flex items-center">
				<input type="checkbox" class="form-checkbox" bind:checked={enableAudioForFirstBot} />
				<span class="ml-2">Enable audio for first bot</span>
			</label>
		</div>
		<div class="flex items-center justify-between">
			<button
				class="focus:shadow-outline rounded bg-blue-500 px-4 py-2 font-bold text-white hover:bg-blue-700 focus:outline-none"
				type="button"
				on:click={addBots}
			>
				Add Bots
			</button>
		</div>
	</form>

	<!-- Meetings Management Panel -->
	<div class="rounded bg-white px-8 pb-8 pt-6 shadow-md">
		<h2 class="mb-4 text-xl font-bold">Meetings Management Panel</h2>
		{#if Object.keys(meetings).length === 0}
			<p>No active meetings.</p>
		{:else}
			<table class="min-w-full leading-normal">
				<thead>
					<tr>
						<th class="border-b-2 px-5 py-3">Meeting ID</th>
						<th class="border-b-2 px-5 py-3">Active Bots</th>
						<th class="border-b-2 px-5 py-3">Active Video Bots</th>
						<th class="border-b-2 px-5 py-3">Active Non-Video Bots</th>
						<th class="border-b-2 px-5 py-3">Desired Video Bots</th>
						<th class="border-b-2 px-5 py-3">Desired Non-Video Bots</th>
						<th class="border-b-2 px-5 py-3">Actions</th>
					</tr>
				</thead>
				<tbody>
					{#each Object.entries(meetings) as [id, meeting]}
						<tr>
							<td class="border-b px-5 py-5">{id}</td>
							<td class="border-b px-5 py-5">{meeting.activeBots}</td>
							<td class="border-b px-5 py-5">{meeting.activeVideoBots}</td>
							<td class="border-b px-5 py-5">{meeting.activeNoneVideoBots}</td>
							<td class="border-b px-5 py-5">
								<input
									type="number"
									min="0"
									class="form-input w-20"
									value={meeting.desiredVideoBots}
									on:input={(e) =>
										adjustBots(
											id,
											parseInt((e.target as HTMLInputElement).value),
											meeting.desiredNoneVideoBots
										)}
								/>
							</td>
							<td class="border-b px-5 py-5">
								<input
									type="number"
									min="0"
									class="form-input w-20"
									value={meeting.desiredNoneVideoBots}
									on:input={(e) =>
										adjustBots(
											id,
											meeting.desiredVideoBots,
											parseInt((e.target as HTMLInputElement).value)
										)}
								/>
							</td>
							<td class="border-b px-5 py-5">
								<button
									class="rounded bg-red-500 px-3 py-1 font-bold text-white hover:bg-red-700"
									on:click={() => adjustBots(id, 0, 0)}
								>
									Remove Bots
								</button>
							</td>
						</tr>
					{/each}
				</tbody>
			</table>
		{/if}
	</div>
</main>

<style>
	main {
		@apply bg-gray-100;
	}
	table {
		@apply w-full text-left;
	}
	th,
	td {
		@apply px-4 py-2;
	}
	th {
		@apply bg-gray-200;
	}
	tr:nth-child(even) {
		@apply bg-gray-50;
	}
</style>
