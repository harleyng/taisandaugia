import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.58.0';

Deno.serve(async (req) => {
  try {
    const supabaseAdmin = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? '',
      {
        auth: {
          autoRefreshToken: false,
          persistSession: false
        }
      }
    );

    // Create regular user account
    const { data: userData, error: userError } = await supabaseAdmin.auth.admin.createUser({
      email: 'user@test.com',
      password: 'user123456',
      email_confirm: true,
      user_metadata: {
        name: 'Nguyễn Văn A'
      }
    });

    if (userError) {
      console.error('Error creating user account:', userError);
    } else {
      console.log('User account created:', userData.user?.id);
    }

    // Create admin account
    const { data: adminData, error: adminError } = await supabaseAdmin.auth.admin.createUser({
      email: 'admin@test.com',
      password: 'admin123456',
      email_confirm: true,
      user_metadata: {
        name: 'Admin User'
      }
    });

    if (adminError) {
      console.error('Error creating admin account:', adminError);
    } else {
      console.log('Admin account created:', adminData.user?.id);
      
      // Assign ADMIN role to admin user
      const { error: roleError } = await supabaseAdmin
        .from('user_roles')
        .insert({
          user_id: adminData.user!.id,
          role: 'ADMIN'
        });

      if (roleError) {
        console.error('Error assigning admin role:', roleError);
      } else {
        console.log('Admin role assigned successfully');
      }
    }

    return new Response(
      JSON.stringify({
        success: true,
        message: 'Test accounts created successfully',
        accounts: {
          user: { email: 'user@test.com', password: 'user123456', name: 'Nguyễn Văn A' },
          admin: { email: 'admin@test.com', password: 'admin123456', name: 'Admin User', role: 'ADMIN' }
        }
      }),
      { headers: { 'Content-Type': 'application/json' } }
    );
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Unknown error occurred';
    return new Response(
      JSON.stringify({ error: message }),
      { status: 500, headers: { 'Content-Type': 'application/json' } }
    );
  }
});
