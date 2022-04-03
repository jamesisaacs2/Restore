using System.Collections.Generic;
using System.Text;
using API.Data;
using API.Entities;
using API.Entities.OrderAggregate;
using API.Middleware;
using API.Services;
using Microsoft.AspNetCore.Authentication.JwtBearer;
using Microsoft.AspNetCore.Builder;
using Microsoft.AspNetCore.Hosting;
using Microsoft.AspNetCore.Identity;
using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.Configuration;
using Microsoft.Extensions.DependencyInjection;
using Microsoft.Extensions.Hosting;
using Microsoft.IdentityModel.Tokens;
using Microsoft.OpenApi.Models;
using Swashbuckle.AspNetCore.SwaggerGen;

namespace API
{
   public class Startup
   {
      public Startup(IConfiguration configuration)
      {
         Configuration = configuration;
      }

      public IConfiguration Configuration { get; }

      // This method gets called by the runtime. Use this method to add services to the container.
      public void ConfigureServices(IServiceCollection services)
      {
         services.AddControllers();

         services.AddSwaggerGen(gen =>
         {
            gen.SwaggerDoc("v1", new OpenApiInfo { Title = "API", Version = "v1" });
            gen.AddSecurityDefinition("Bearer", new OpenApiSecurityScheme
            {
               Description = "Jwt auth header",
               Name = "Authorization",
               In = ParameterLocation.Header,
               Type = SecuritySchemeType.ApiKey,
               Scheme = "Bearer"
            });
            gen.AddSecurityRequirement(new OpenApiSecurityRequirement
            {
               {
                  new OpenApiSecurityScheme
                  {
                     Reference = new OpenApiReference
                     {
                        Type = ReferenceType.SecurityScheme,
                        Id = "Bearer"
                     },
                     Scheme = "oauth2",
                     Name = "Bearer",
                     In = ParameterLocation.Header
                  },
                  new List<string>()
               }
            });
         });

         services.AddDbContext<StoreContext>(options =>
         {
            options.UseSqlite(Configuration.GetConnectionString("DefaultConnection"));
         });

         services.AddCors();

         services.AddIdentityCore<User>(options =>
         {
            options.User.RequireUniqueEmail = true;
            options.Password.RequiredLength = 13;
         })
            .AddRoles<Role>()
            .AddEntityFrameworkStores<StoreContext>();

         services.AddAuthentication(JwtBearerDefaults.AuthenticationScheme)
            .AddJwtBearer(options =>
            {
               options.TokenValidationParameters = new TokenValidationParameters
               {
                  ValidateIssuer = false,
                  ValidateAudience = false,
                  ValidateLifetime = true,
                  ValidateIssuerSigningKey = true,
                  IssuerSigningKey = new SymmetricSecurityKey(Encoding.UTF8
                     .GetBytes(Configuration["JWTSettings:TokenKey"]))
               };
            });
         services.AddAuthorization();
         services.AddScoped<TokenService>();
      }

      // This method gets called by the runtime. Use this method to configure the HTTP request pipeline.
      public void Configure(IApplicationBuilder app, IWebHostEnvironment env)
      {
         app.UseMiddleware<ExceptionMiddleware>();

         if (env.IsDevelopment())
         {
            //app.UseDeveloperExceptionPage();//replaced by ExceptionMiddleware page
            app.UseSwagger();
            app.UseSwaggerUI(c => c.SwaggerEndpoint("/swagger/v1/swagger.json", "WebAPIv5 v1.07"));
         }

         //app.UseHttpsRedirection();

         app.UseRouting();

         //CORS must go here:
         app.UseCors(opt =>
         {
            opt.AllowAnyHeader().AllowAnyMethod().AllowCredentials().WithOrigins("http://localhost:3000", "http://localhost:3001");
         });

         app.UseAuthentication();
         app.UseAuthorization();

         app.UseEndpoints(endpoints =>
         {
            endpoints.MapControllers();
         });
      }
   }
}
