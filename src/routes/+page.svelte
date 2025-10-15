<script lang="ts">
    import { onMount } from 'svelte';
    import type { PageProps } from './$types';
    import { invalidateAll } from '$app/navigation';

    let { data }: PageProps = $props();

    let locationInput = $state('');
    let aqi: { value: number; category: string; drivenBy: string } = $state({
        value: 0,
        category: '',
        drivenBy: ''
    });

    // Returns strings like "just now", "42 min ago", "2 hr ago", "3 d ago", or "09 Oct"
    function relativeTimeFromPubDate(pubDateStr: string, now = new Date()) {
        // 1) Parse RFC-1123/RFC-822 pubDate in UTC
        const publishedUtc = new Date(pubDateStr); // Google News RSS uses GMT; Date parses it as UTC

        // 2) Compute delta in minutes using absolute timestamps
        const deltaMs = now.getTime() - publishedUtc.getTime();
        if (deltaMs < 0) return 'just now'; // future skew
        const minutes = Math.floor(deltaMs / 60000);

        // 3) Format into friendly buckets
        if (minutes < 1) return 'just now';
        if (minutes < 60) return `${minutes} min ago`;

        const hours = Math.floor(minutes / 60);
        if (hours < 24) return `${hours} hr ago`;

        const days = Math.floor(hours / 24);
        if (days < 7) return `${days} d ago`;

        // 4) Older than a week → short date in local timezone
        const d = publishedUtc;
        const day = String(d.getDate()).padStart(2, '0');
        const mon = d.toLocaleString(undefined, { month: 'short' });
        return `${day} ${mon}`;
    }

    const currentTime = new Date();
    const currentDate = currentTime.toLocaleDateString('en', {
        weekday: 'long',
        month: 'short',
        day: 'numeric'
    });
    let clock = $state(
        currentTime
            .toLocaleTimeString('en', { hour: '2-digit', minute: '2-digit' })
            .toLowerCase()
            .substring(0, 5)
    );
    let dayPeriod = currentTime.getHours() >= 12 ? 'pm' : 'am';
    setInterval(() => {
        const now = new Date();
        clock = now
            .toLocaleTimeString('en', { hour: '2-digit', minute: '2-digit' })
            .toLowerCase()
            .substring(0, 5);
    }, 60000);

    let mapInitialized = $state(false);

    // NEW: US EPA AQI Calculation Functions
    function getUsaAqi(components: { pm2_5: number; o3: number; [key: string]: number }) {
        const aqiBreakpoints: { [key: string]: number[] } = {
            pm2_5: [0, 12, 35.4, 55.4, 150.4, 250.4, 350.4, 500.4],
            o3_ppm: [0, 0.054, 0.07, 0.085, 0.105, 0.2], // 8-hour
            aqi: [0, 50, 100, 150, 200, 300, 400, 500]
        };

        const calcAqi = (
            concentration: number,
            breakpoints_pollutant: number[],
            breakpoints_aqi: number[]
        ) => {
            let i = breakpoints_pollutant.findIndex((b) => b >= concentration);
            if (i === -1) i = breakpoints_pollutant.length - 1; // Use highest category if above range

            const c_high = breakpoints_pollutant[i];
            const c_low = breakpoints_pollutant[i - 1];
            const i_high = breakpoints_aqi[i];
            const i_low = breakpoints_aqi[i - 1];

            return Math.round(
                ((i_high - i_low) / (c_high - c_low)) * (concentration - c_low) + i_low
            );
        };

        const pm2_5_aqi = calcAqi(components.pm2_5, aqiBreakpoints.pm2_5, aqiBreakpoints.aqi);

        // Convert O3 from μg/m³ to ppm (O3 molar mass: 48 g/mol)
        const o3_ppm = components.o3 / 1960;
        const o3_aqi = calcAqi(o3_ppm, aqiBreakpoints.o3_ppm, aqiBreakpoints.aqi);

        const finalAqi = Math.max(pm2_5_aqi, o3_aqi);
        const drivenBy = pm2_5_aqi >= o3_aqi ? 'PM2.5' : 'Ozone (O₃)';

        let category = '';
        if (finalAqi <= 50) category = 'Good';
        else if (finalAqi <= 100) category = 'Moderate';
        else if (finalAqi <= 150) category = 'Unhealthy for Sensitive Groups';
        else if (finalAqi <= 200) category = 'Unhealthy';
        else if (finalAqi <= 300) category = 'Very Unhealthy';
        else category = 'Hazardous';

        return { value: finalAqi, category, drivenBy };
    }
    // let summary = $state(`<h2>Guwahati News Summary</h2> <h3>Crime &amp; Law Enforcement</h3> <ul> <li>CID recorded statements from two more Assamese expats in Singapore in the Zubeen Garg case.</li> <li>Two individuals, Shyamkanu and Siddharth, are nearing the end of their CID custody; their next location is unknown.</li> <li>Three arrests were made in Kamrup-M for a girl's murder.</li> <li>A man was arrested in Guwahati by the GST Department in a fake ITC case.</li> <li>A salon employee was found hanging in Guwahati, with the family suspecting foul play.</li> <li>An accused in the DB Stock Broking Scam was reportedly assaulted inside Guwahati Central Jail.</li> <li>A man allegedly beat his 80-year-old grandmother to death.</li> <li>A CM Vigilance team arrested a NAM official in Nagaon.</li> <li>The Congress party filed FIRs against CM Himanta Biswa Sarma.</li> <li>Guwahati is experiencing a rise in theft and burglary cases, causing fear among residents.</li> </ul> <h3>Civic &amp; Infrastructure</h3> <ul> <li>The Chandmari Flyover in Guwahati will be closed for maintenance on October 13, 15, and 17, with  diversions.</li> <li>Potholes on Guwahati's AT Road Bridge and Old Panbazar Road Overbridge pose a serious risk to commuters.</li> <li>A new Kamakhya-Pandu Road has been completed, but its inauguration is delayed.</li> <li>A water pipe leak was reported in Guwahati’s Ambari, with no injuries.</li> <li>An old tree collapsed in Guwahati's Uzan Bazar Ghat, damaging two cars.</li> <li>Informal vehicle recovery networks in Guwahati are blurring legal lines.</li> <li>The vision for a beggar-free Guwahati has not materialized two years on.</li> <li>Concerns are rising over easy access to alcohol in Assam’s capital.</li> <li>Kamakhya Railway Station continues to face maintenance issues despite promises.</li> </ul> <h3>Education &amp; Employment</h3> <ul> <li>Gauhati University's PGSU elections saw ABVP and AASU split key posts in a close contest.</li> <li>Six Bodo students were elected to the students' unions of Cotton University and Jorhat Engineering College.</li> <li>IIT Guwahati's first Data Science &amp; AI batch has graduated with strong placements.</li> <li>Assam Engineering College received national recognition for promoting standardization education.</li> <li>DEE Assam has set a final window for academic and ID detail submission for teacher posts.</li> <li>Assam aims to train 50,000 students in Japanese for overseas employment.</li> <li>Assam has launched the CM-FLIGHT initiative to train youth for high-paying jobs abroad.</li> <li>A Guwahati-based trust is organizing "Skill Utsav-2025" to train over 500 youth.</li> <li>7,650 candidates have been selected across 50 departments in Assam's ADRE results.</li> </ul> <h3>Health &amp; Social Welfare</h3> <ul> <li>PM Modi unveiled the Northeast's first Livestock IVF Lab in Guwahati.</li> <li>Assam has unveiled the ₹4,287 Cr ASTHA Plan to revolutionize tertiary healthcare.</li> <li>Experts are calling for teamwork to tackle head &amp; neck cancers.</li> <li>An increase in student suicides is linked to mental health issues, according to a GMCH expert.</li> <li>TISS Guwahati observed World Mental Health Day 2025, emphasizing support in crisis situations.</li> <li>Assam Rifles organized a lecture on World Mental Health Day in Lokra.</li> <li>CM Himanta Biswa Sarma provided ₹5 Lakh relief to flutist Dipak Sarma for treatment.</li> <li>An appeal has been made for proper medical care for Premadhar Sarma in Guwahati.</li> </ul> <h3>Culture &amp; Events</h3> <ul> <li>The 61st Kali Puja in Guwahati's Kalapahar will feature 'Har Har Mahadev'.</li> <li>The Northeast's first Venkateshwara Temple is set to open in Guwahati.</li> <li>The first 3D Dome Theatre in Guwahati will open at the Science Centre.</li> <li>Assam filmgoers are returning to theatres as the box office rebounds.</li> <li>B Borooah College presented the inaugural Gopinath Bordoloi Award to PG Baruah.</li> <li>The 9th annual conference of the North East India Commerce &amp; Management Association (NEICMA) was held in Tinsukia.</li> </ul> <h3>Politics &amp; Governance</h3> <ul> <li>Justice Biplab Kumar Sharma has called for an urgent revision of Assam's voter list due to the presence of foreigners.</li> <li>Assam has established 7 Panchayat Tribunals to expedite poll disputes.</li> <li>CM Himanta Biswa Sarma launched the Orunodoi 3.0 Scheme in Assam.</li> <li>Congress leader Debabrata Saikia criticized BJP for weakening the RTI Act.</li> <li>Riniki Bhuyan Sharma filed a defamation case against Akhil Gogoi.</li> <li>Chief Secretary stated that "Organised Players and STGs Must Coexist without Conflict in Assam’s Tea Industry."</li> </ul> <h3>Tributes &amp; Public Figures</h3> <ul> <li>The Assamese diaspora in the U.S. celebrated the life of Zubeen Garg.</li> <li>A tribute website has been built to stream Zubeen Garg's legacy online.</li> <li>An online movement demanding justice for Zubeen Garg was ignited by Amrita Gogoi's post.</li> <li>The CM urged people to buy crackers, but sellers are skeptical as the state mourns an icon (likely Zubeen Garg).</li> </ul> <h3>Other</h3> <ul> <li>Thousands gathered in Guwahati to demand land rights and protest against evictions.</li> <li>Governor Acharya attended a Veterans’ Swabhimaan Rally in Guwahati, praising the soldiers' spirit.</li> </ul> <small>Note: Some news items, particularly those related to Zubeen Garg, refer to similar events without direct duplication and have been grouped by topic.</small><!---->`);
    let summaryLoaded = $state(false);
    let summary = $state(``);

    $effect(() => {
        (async () => {
            const briefData = await data.briefData;
            if (briefData && !mapInitialized) {
                aqi = getUsaAqi(briefData.air.list[0].components);
            }

            summary = '';
            const response = await fetch('/api/summary', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ posts: briefData.posts })
            });

            if (response.body) {
                const reader = response.body.getReader();
                const decoder = new TextDecoder();
                while (true) {
                    const { done, value } = await reader.read();
                    if (done) break;
                    summary += decoder.decode(value, { stream: true });
                }
                summaryLoaded = true;
            }
        })();
    });

    onMount(() => {
        locationInput = localStorage.getItem('location') || 'New York';
    });
    async function getBrief() {
        // Reset the flag when fetching new data
        summaryLoaded = false;
        localStorage.setItem('location', locationInput);
        await invalidateAll();
    }
</script>

<main>
    <div class="flex justify-between max-md:flex-row-reverse">
        <div class="flex flex-wrap items-center gap-2 max-md:justify-end md:flex-1 md:gap-4">
            <input
                type="text"
                name="location"
                id="location"
                placeholder="Enter location"
                class="rounded-md border-b-2 border-b-gray-500 p-2"
                bind:value={locationInput} />
            <button
                class="cursor-pointer rounded bg-[#666] px-4 py-2 text-white hover:bg-[#888]"
                onclick={getBrief}>Get Brief</button>
        </div>
        <h1 class="text-4xl font-normal md:text-center">Local Brief</h1>
        <div class="flex-1 max-md:hidden"></div>
    </div>
    <div class="module-grid bg-[#dddddd]">
        {#await data.briefData}
            <div class="module time skeleton" style="grid-area: time;"></div>
            <div class="module weather skeleton" style="grid-area: weather;"></div>
            <div class="module news skeleton" style="grid-area: news;">
                <h2>News</h2>
                <div class="grid h-2 grow gap-6 overflow-auto *:rounded-lg">
                    {#each Array(6) as _}
                        <div class="skeleton bg-[#bbbbbb] px-2 hover:bg-[#aaaaaa]">
                            <div class="justify-between text-xs font-medium" style="display: flex;">
                                <span class="me-2 line-clamp-1 flex-1">&nbsp;</span>
                                <span>&nbsp;</span>
                            </div>
                        </div>
                    {/each}
                </div>
            </div>
            <div class="module air skeleton" style="grid-area: air;"></div>
        {:then briefData}
            <div class="module time" style="grid-area: time;">
                <div class="flex items-baseline gap-2">
                    <h2>{clock}</h2>
                    <span class="text-xl">{dayPeriod}</span>
                </div>
                <span class="mt-2 text-lg font-light">{currentDate}</span>
                <span class="mt-2 text-lg font-light"
                    ><span class="font-medium">Humidity:</span>
                    {briefData.current.main.humidity}%</span>
            </div>

            <div class="module weather gap-4" style="grid-area: weather;">
                <div class="flex items-end">
                    <h2>{Math.round(briefData.current.main.temp)}°</h2>
                    <span class="text-2xl font-light"
                        >{briefData.current.weather[0].description}</span>
                </div>
                <div class="grid w-full grid-cols-4" style="gap: clamp(0.3rem, 2vw, 1.5rem)">
                    {#each briefData.hourly.list.slice(0, 4) as hour (hour.dt)}
                        <div
                            class="grid flex-1 place-items-center rounded-md bg-[#bbbbbb] p-3 md:p-5"
                            style="font-size:clamp(1.5rem, 2vw, 3.5rem)">
                            <div style="font-size:clamp(0.8rem, 1.5vw, 1.2rem)">
                                {new Date(hour.dt_txt)
                                    .toLocaleTimeString('en', { hour: '2-digit', hour12: true })
                                    .toLowerCase()
                                    .substring(0, 2)}
                                <span class=""
                                    >{new Date(hour.dt_txt)
                                        .toLocaleTimeString('en', { hour: '2-digit', hour12: true })
                                        .toLowerCase()
                                        .substring(3, 5)}</span>
                            </div>
                            <div>{Math.round(hour.main.temp)}°</div>
                        </div>
                    {/each}
                </div>
            </div>

            <div class="module news overflow-hidden" style="grid-area: news;">
                <h2>News</h2>
                <div class="grid h-2 grow gap-6 overflow-auto *:rounded-lg">
                    {#each briefData.posts.items as item, i (item.link)}
                        <div class="bg-[#bbbbbb] px-2 hover:bg-[#aaaaaa]">
                            <div class="justify-between text-xs font-medium" style="display: flex;">
                                <span class="me-2 line-clamp-1 flex-1">{item.source}</span>
                                {#if item.pubDate}
                                    <span>{relativeTimeFromPubDate(item.pubDate, new Date())}</span>
                                {/if}
                            </div>
                            <a
                                href={item.link}
                                target="_blank"
                                rel="noopener noreferrer"
                                class="line-clamp-2 text-sm">{item.title}</a>
                        </div>
                    {/each}
                </div>
            </div>

            <div class="module air" style="grid-area: air;">
                <div class="flex items-baseline text-xl">
                    AQI:
                    <h2>{aqi.value}</h2>
                </div>
                <div>
                    <p class="text-lg">{aqi.category}</p>
                    <p class="text-lg">Driven by <span class="font-medium">{aqi.drivenBy}</span></p>
                </div>
            </div>
        {:catch error}
            <p>Error loading brief data: {error.message}</p>
        {/await}
        <div
            class="module summary overflow-hidden {summaryLoaded ? '' : 'skeleton'}"
            style="grid-area: summary;">
            <div class="grid h-2 grow overflow-auto">{@html summary}</div>
            <small>{summaryLoaded ? 'AI generated summary' : ''}</small>
        </div>
    </div>
</main>

<style lang="scss">
    main {
        background-color: #eeeeee;
        padding: 1.5rem;
        padding-block: 1rem;
        min-height: 100vh;
        gap: 1rem;
        display: flex;
        flex-direction: column;
        @media screen and (width <= 768px) {
            padding: 1rem;
        }
    }
    .module-grid {
        display: grid;
        grid-template-areas:
            'time weather weather news'
            'summary summary air news';
        grid-template-columns: repeat(4, minmax(0, 1fr));
        grid-template-rows: repeat(2, minmax(0, 1fr));
        padding: 2rem;
        gap: 2rem;
        border-radius: 20px;
        flex: 1;
        @media screen and (width <= 1280px) {
            grid-template-areas:
                'time weather weather'
                'summary summary air'
                'news news news';
            grid-template-columns: 1fr 1fr 1fr;
            // grid-template-rows: repeat(5, minmax(0, auto));
            & .module.news {
                height: 30rem;
            }
        }
        @media screen and (width <= 768px) {
            padding: 1rem;
            gap: 1rem;
            grid-template-areas:
                'time'
                'weather'
                'summary'
                'news'
                'air';
            grid-template-columns: 1fr;
            grid-template-rows: repeat(5, minmax(0, auto));
            & .module {
                padding: 1rem !important;
            }
            & .module.news {
                height: 30rem;
            }
            & .module.summary {
                height: 20rem;
            }
            & .module.air {
                p {
                    font-size: 1rem !important;
                }
            }
        }
        & .module {
            padding: 1.5rem;
            background-color: #cccccc;
            border-radius: 20px;
            display: grid;
            align-content: start;

            h2 {
                font-size: 1.3rem;
                line-height: 0.9;
            }
            &.time {
                h2 {
                    font-size: 4rem;
                    font-weight: 400;
                }
            }
            &.weather {
                align-content: space-between;

                h2 {
                    font-size: 4.5rem;
                    font-weight: 400;
                    line-height: 0.9;
                }
            }
            &.news {
                display: flex;
                flex-direction: column;
                gap: 1rem;

                & > div {
                    & > div {
                        padding: 0.5rem 0.7rem;
                    }
                }
            }
            &.summary {
                display: flex;
                flex-direction: column;
                gap: 0.1rem;
                :global {
                    h2 {
                        font-size: 1.3rem;
                        line-height: 1.5;
                    }
                    h3 {
                        font-size: 1.2rem;
                        margin-top: 1rem;
                        margin-bottom: 0.3rem;
                        font-weight: 500;
                    }
                    b {
                        font-weight: 600;
                    }
                }
            }
            &.air {
                gap: 1rem;
                h2 {
                    font-size: 3.5rem;
                    font-weight: 400;
                    line-height: 0.9;
                }
            }
        }
    }
    .skeleton {
        position: relative;
        overflow: hidden;
    }
    .skeleton::after {
        content: '';
        position: absolute;
        top: 0;
        left: -150px;
        width: 150px;
        height: 100%;
        background: linear-gradient(90deg, transparent, rgba(255, 255, 255, 0.2), transparent);
        animation: loading 1.5s infinite;
    }
    @keyframes loading {
        0% {
            left: -150px;
        }
        100% {
            left: 100%;
        }
    }
</style>
