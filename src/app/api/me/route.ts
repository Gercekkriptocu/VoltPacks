import { type NextRequest, NextResponse } from 'next/server'
import { createClient, Errors } from '@farcaster/quick-auth'

const client = createClient()

type UserData = {
  fid: number
  primaryAddress?: string
  username?: string
  displayName?: string
  pfpUrl?: string
}

async function resolveUser(fid: number): Promise<UserData> {
  try {
    const response = await fetch(
      `https://api.neynar.com/v2/farcaster/user/bulk?fids=${fid}`,
      {
        headers: {
          accept: 'application/json',
          'x-api-key': process.env.NEYNAR_API_KEY ?? 'NEYNAR_FROG_FM',
        },
      }
    )

    if (response.ok) {
      const data = await response.json() as {
        users: Array<{
          fid: number
          username: string
          display_name: string
          pfp_url: string
          custody_address?: string
          verifications?: string[]
        }>
      }

      const user = data.users[0]
      if (user) {
        return {
          fid: user.fid,
          username: user.username,
          displayName: user.display_name,
          pfpUrl: user.pfp_url,
          primaryAddress: user.custody_address || user.verifications?.[0],
        }
      }
    }
  } catch (error) {
    console.error('Error fetching user data from Neynar:', error)
  }

  return {
    fid,
  }
}

export async function GET(request: NextRequest): Promise<NextResponse> {
  try {
    const authorization = request.headers.get('Authorization')
    
    if (!authorization || !authorization.startsWith('Bearer ')) {
      return NextResponse.json(
        { error: 'Missing or invalid authorization header' },
        { status: 401 }
      )
    }

    const token = authorization.split(' ')[1]
    if (!token) {
      return NextResponse.json(
        { error: 'Missing token' },
        { status: 401 }
      )
    }

    const url = new URL(request.url)
    const domain = url.hostname

    const payload = await client.verifyJwt({
      token,
      domain,
    })

    const user = await resolveUser(payload.sub)

    return NextResponse.json(user)
  } catch (error) {
    if (error instanceof Errors.InvalidTokenError) {
      console.info('Invalid token:', error.message)
      return NextResponse.json(
        { error: 'Invalid token' },
        { status: 401 }
      )
    }

    console.error('Error in /api/me:', error)
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    )
  }
}
