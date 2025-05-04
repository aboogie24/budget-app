import { useRouter, usePathname } from 'expo-router';
import { useEffect, useState } from 'react';
import { findUserSession } from '@/utils/storage';

export function useAuthGuard() {
  const router = useRouter();
  const pathname = usePathname();
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const checkSession = async () => {
      const user = await findUserSession();
      const publicPaths = ['/login', '/register', '/'];

      console.log(user); 
      console.log(publicPaths.includes(pathname))
      console.log(pathname)

      if (!user && !publicPaths.includes(pathname)) {
        router.replace('/login');
      } else if (user && publicPaths.includes(pathname)) {
        router.replace('/dashboard');
      }

      setLoading(false);
    };

    checkSession();
  }, [pathname]);

  return loading;
}