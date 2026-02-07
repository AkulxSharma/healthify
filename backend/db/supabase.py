import os
from functools import lru_cache
from typing import Optional

from supabase import Client, create_client


@lru_cache(maxsize=1)
def get_supabase_client() -> Optional[Client]:
    supabase_url = os.getenv("SUPABASE_URL")
    supabase_key = os.getenv("SUPABASE_SERVICE_ROLE_KEY")
    if not supabase_url or not supabase_key:
        return None
    return create_client(supabase_url, supabase_key)
