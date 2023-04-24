import { Route } from '../../apis'
import { getAttribute, getCheerio, getDataAttribute } from '../../utils/cheerio'
import { parseReadableNumber } from '../../utils/number'
import { toHHMMSS } from '../../utils/time'
import { UrlParser } from '../../utils/url'
import type { Engine } from '../../core/engine'
import type { CheerioAPI } from 'cheerio'

export interface VideoPage {
    id: string
    title: string
    views: number
    vote: {
        up: number
        down: number
        total: number
        rating: number
    }
    premium: boolean
    thumb: string
    /**
     * @deprecated We no longer support video download. Use alternative tools such as `yt-dlp` instead.
     */
    videos: Array<{
        url: string
        quality: string
        filename: string
        extension: string
    }>
    provider: {
        username: string
        url: string
    } | null
    /** video duration (in second) */
    duration: number
    /** video duration formatted in "(HH:)mm:ss". eg. "32:09", "01:23:05" */
    durationFormatted: string
    tags: string[]
    pornstars: string[]
    categories: string[]
}

// const parseFileName = (str: string) => /\/([a-zA-Z0-9%=&_-]+\.(mp4|flv))/.exec(str)

export async function videoPage(engine: Engine, urlOrId: string): Promise<VideoPage> {
    const id = UrlParser.getVideoID(urlOrId)
    const url = Route.videoPage(id)
    const html = await engine.request.raw(url)
    const $ = getCheerio(html)

    return {
        id,
        ...parseByDom(html, $),
    }
}

function parseByDom(html: string, $: CheerioAPI) {
    const voteUp = parseReadableNumber($('span.votesUp').text() || '0')
    const voteDown = parseReadableNumber($('span.votesDown').text() || '0')

    const title = $('head > title').first().text().replace(' - Pornhub.com', '')
    const viewsText = $('span.count').text() || '0'
    const views = parseReadableNumber(viewsText)
    const vote = {
        up: voteUp,
        down: voteDown,
        total: voteUp + voteDown,
        rating: Math.round(voteUp / (voteUp + voteDown) * 100) / 100,
    }
    const premium = $('.video-wrapper .ph-icon-badge-premium').length !== 0
    const thumb = getAttribute<string>($('.thumbnail img'), 'src', '')

    // wtf...is this double rel a coding bug from pornhub?
    // <a rel="rel="nofollow"" href="/users/xxxx"  class="bolded">XXXXX</a>
    const providerLink = $('.usernameBadgesWrapper a.bolded').first()
    const provider = providerLink.length
        ? { username: providerLink.text(), url: getAttribute<string>(providerLink, 'href', '') }
        : null

    const trafficJunkyMeta = $('head meta[name=adsbytrafficjunkycontext]')
    const tags = getDataAttribute<string>(trafficJunkyMeta, 'context-tag')?.split(',') || []
    const pornstars = getDataAttribute<string>(trafficJunkyMeta, 'context-pornstar')?.split(',') || []
    const categories = getDataAttribute<string>(trafficJunkyMeta, 'context-category')?.split(',') || []

    const durationMeta = $('head meta[property="video:duration"]')
    const duration = +getAttribute<number>(durationMeta, 'content', 0)
    const durationFormatted = toHHMMSS(duration)

    return {
        title,
        views,
        vote,
        premium,
        thumb,
        videos: [],
        provider,
        tags,
        pornstars,
        categories,
        duration,
        durationFormatted,
    }
}
