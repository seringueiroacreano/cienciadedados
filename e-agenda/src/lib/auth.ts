import { NextAuthOptions } from 'next-auth';
import GoogleProvider from 'next-auth/providers/google';
import { supabaseAdmin } from './supabase';

export const authOptions: NextAuthOptions = {
  providers: [
    GoogleProvider({
      clientId: process.env.GOOGLE_CLIENT_ID || '',
      clientSecret: process.env.GOOGLE_CLIENT_SECRET || '',
      authorization: {
        params: {
          scope:
            'openid email profile https://www.googleapis.com/auth/calendar',
          access_type: 'offline',
          prompt: 'consent',
        },
      },
    }),
  ],
  callbacks: {
    async signIn({ user, account }) {
      if (!user.email) return false;

      try {
        const { data: existingUser } = await supabaseAdmin
          .from('users')
          .select('*')
          .eq('google_id', user.id)
          .single();

        if (!existingUser) {
          await supabaseAdmin.from('users').insert({
            google_id: user.id,
            email: user.email,
            name: user.name || '',
            photo_url: user.image || '',
            role: 'VIEWER',
            setor: 'OUTRO',
          });
        } else {
          await supabaseAdmin
            .from('users')
            .update({
              last_login: new Date().toISOString(),
              name: user.name || existingUser.name,
              photo_url: user.image || existingUser.photo_url,
            })
            .eq('google_id', user.id);
        }

        if (account?.access_token) {
          await supabaseAdmin
            .from('users')
            .update({
              google_access_token: account.access_token,
              google_refresh_token: account.refresh_token || null,
            })
            .eq('google_id', user.id);
        }

        return true;
      } catch (error) {
        console.error('Error during sign in:', error);
        return true;
      }
    },
    async jwt({ token, user, account }) {
      if (user) {
        const { data: dbUser } = await supabaseAdmin
          .from('users')
          .select('*')
          .eq('google_id', user.id)
          .single();

        if (dbUser) {
          token.userId = dbUser.id;
          token.role = dbUser.role;
          token.setor = dbUser.setor;
          token.googleId = dbUser.google_id;
        }
      }
      if (account?.access_token) {
        token.accessToken = account.access_token;
      }
      return token;
    },
    async session({ session, token }) {
      if (session.user) {
        (session.user as Record<string, unknown>).id = token.userId;
        (session.user as Record<string, unknown>).role = token.role;
        (session.user as Record<string, unknown>).setor = token.setor;
        (session.user as Record<string, unknown>).googleId = token.googleId;
        (session.user as Record<string, unknown>).accessToken =
          token.accessToken;
      }
      return session;
    },
  },
  pages: {
    signIn: '/login',
  },
  session: {
    strategy: 'jwt',
  },
  secret: process.env.NEXTAUTH_SECRET,
};
