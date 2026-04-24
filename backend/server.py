from fastapi import FastAPI, HTTPException, UploadFile, File
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel, Field
from typing import List, Optional, Dict, Any
from datetime import datetime
from pymongo import MongoClient
from bson import ObjectId
import os
from dotenv import load_dotenv

load_dotenv()

app = FastAPI()

# CORS
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# MongoDB - CORREGIDO: Lee DB_NAME del environment
MONGO_URL = os.getenv("MONGO_URL", "mongodb://localhost:27017")
client = MongoClient(MONGO_URL)
DB_NAME = os.getenv("DB_NAME", "calculadora_precios")
db = client[DB_NAME]

# Colecciones
productos_col = db["productos"]
flujos_col = db["flujos"]
calculos_col = db["calculos"]
cotizaciones_col = db["cotizaciones"]

# ==================== MODELS ====================

class PyObjectId(ObjectId):
    @classmethod
    def __get_validators__(cls):
        yield cls.validate

    @classmethod
    def validate(cls, v):
        if not ObjectId.is_valid(v):
            raise ValueError("Invalid ObjectId")
        return ObjectId(v)

    @classmethod
    def __get_pydantic_json_schema__(cls, core_schema, handler):
        return {"type": "string"}

class Operacion(BaseModel):
    nombre: str
    tipo_operacion: str
    tipo_valor: str
    orden: int

class Flujo(BaseModel):
    nombre: str
    operaciones: List[Operacion] = []
    fecha_creacion: Optional[datetime] = None

class FlujoResponse(Flujo):
    id: str = Field(alias="_id")

    class Config:
        populate_by_name = True

class Producto(BaseModel):
    nombre: str
    costo_original: float
    costo_base: float
    flujo_id: Optional[str] = None
    comentarios: Optional[str] = ""
    fecha_creacion: Optional[datetime] = None

class ProductoResponse(Producto):
    id: str = Field(alias="_id")

    class Config:
        populate_by_name = True

class Cliente(BaseModel):
    nombre: str
    porcentaje_ganancia: float
    comentario: Optional[str] = ""
    precio_final: float

class Calculo(BaseModel):
    nombre_producto: str
    producto_id: Optional[str] = None
    flujo_nombre: str
    flujo_id: Optional[str] = None
    valores_operaciones: Dict[str, float] = {}
    clientes: List[Cliente] = []
    costo_base: float
    precio_calculado: Optional[float] = None  # Precio después del flujo, antes de ganancia
    fecha: Optional[datetime] = None

class CalculoResponse(Calculo):
    id: str = Field(alias="_id")

    class Config:
        populate_by_name = True

class ItemCotizacion(BaseModel):
    cantidad: int
    producto_id: str
    nombre_producto: str
    precio_unitario: float
    subtotal: float

class Cotizacion(BaseModel):
    nombre_cliente: Optional[str] = ""
    items: List[ItemCotizacion] = []
    total: float
    fecha: Optional[datetime] = None

class CotizacionResponse(Cotizacion):
    id: str = Field(alias="_id")

    class Config:
        populate_by_name = True

class CalcularPrecioRequest(BaseModel):
    costo_base: float
    flujo_id: str
    valores_operaciones: Dict[str, float]
    clientes: List[Dict[str, Any]]

# ==================== HELPERS ====================

def serialize_doc(doc):
    if doc and "_id" in doc:
        doc["_id"] = str(doc["_id"])
    return doc

def aplicar_operacion(precio_base: float, operacion: dict, valor: float) -> float:
    tipo_op = operacion["tipo_operacion"]
    tipo_val = operacion["tipo_valor"]
    
    if tipo_val == "Porcentaje":
        if tipo_op == "Sumar":
            return precio_base + (precio_base * valor / 100)
        elif tipo_op == "Restar":
            return precio_base - (precio_base * valor / 100)
        elif tipo_op == "Multiplicar":
            return precio_base * (valor / 100)
        elif tipo_op == "Dividir":
            return precio_base / (valor / 100) if valor != 0 else precio_base
    else:
        if tipo_op == "Sumar":
            return precio_base + valor
        elif tipo_op == "Restar":
            return precio_base - valor
        elif tipo_op == "Multiplicar":
            return precio_base * valor
        elif tipo_op == "Dividir":
            return precio_base / valor if valor != 0 else precio_base
    
    return precio_base

# ==================== ENDPOINTS PRODUCTOS ====================

@app.get("/api/productos")
def get_productos(skip: int = 0, limit: int = 0):
    # Si limit es 0, obtener todos los productos
    if limit == 0:
        productos = list(productos_col.find().skip(skip))
    else:
        productos = list(productos_col.find().skip(skip).limit(limit))
    return [serialize_doc(p) for p in productos]

@app.get("/api/productos/count")
def count_productos():
    total = productos_col.count_documents({})
    return {"total": total}

@app.get("/api/productos/buscar")
def buscar_productos(q: str, limit: int = 200):
    regex = {"$regex": q, "$options": "i"}
    productos = list(productos_col.find({"nombre": regex}).limit(limit))
    return [serialize_doc(p) for p in productos]

@app.get("/api/productos/{producto_id}")
def get_producto(producto_id: str):
    producto = productos_col.find_one({"_id": ObjectId(producto_id)})
    if not producto:
        raise HTTPException(status_code=404, detail="Producto no encontrado")
    return serialize_doc(producto)

@app.post("/api/productos")
def crear_producto(producto: Producto):
    producto_dict = producto.model_dump()
    producto_dict["fecha_creacion"] = datetime.now()
    result = productos_col.insert_one(producto_dict)
    producto_dict["_id"] = str(result.inserted_id)
    return serialize_doc(producto_dict)

@app.put("/api/productos/{producto_id}")
def actualizar_producto(producto_id: str, producto: Producto):
    result = productos_col.update_one(
        {"_id": ObjectId(producto_id)},
        {"$set": producto.model_dump(exclude_unset=True)}
    )
    if result.matched_count == 0:
        raise HTTPException(status_code=404, detail="Producto no encontrado")
    return {"message": "Producto actualizado"}

@app.delete("/api/productos/{producto_id}")
def eliminar_producto(producto_id: str):
    result = productos_col.delete_one({"_id": ObjectId(producto_id)})
    if result.deleted_count == 0:
        raise HTTPException(status_code=404, detail="Producto no encontrado")
    return {"message": "Producto eliminado"}

# ==================== ENDPOINTS FLUJOS ====================

@app.get("/api/flujos")
def get_flujos():
    flujos = list(flujos_col.find())
    return [serialize_doc(f) for f in flujos]

@app.get("/api/flujos/{flujo_id}")
def get_flujo(flujo_id: str):
    flujo = flujos_col.find_one({"_id": ObjectId(flujo_id)})
    if not flujo:
        raise HTTPException(status_code=404, detail="Flujo no encontrado")
    return serialize_doc(flujo)

@app.post("/api/flujos")
def crear_flujo(flujo: Flujo):
    flujo_dict = flujo.model_dump()
    flujo_dict["fecha_creacion"] = datetime.now()
    result = flujos_col.insert_one(flujo_dict)
    flujo_dict["_id"] = str(result.inserted_id)
    return serialize_doc(flujo_dict)

@app.put("/api/flujos/{flujo_id}")
def actualizar_flujo(flujo_id: str, flujo: Flujo):
    result = flujos_col.update_one(
        {"_id": ObjectId(flujo_id)},
        {"$set": flujo.model_dump(exclude_unset=True)}
    )
    if result.matched_count == 0:
        raise HTTPException(status_code=404, detail="Flujo no encontrado")
    return {"message": "Flujo actualizado"}

@app.delete("/api/flujos/{flujo_id}")
def eliminar_flujo(flujo_id: str):
    result = flujos_col.delete_one({"_id": ObjectId(flujo_id)})
    if result.deleted_count == 0:
        raise HTTPException(status_code=404, detail="Flujo no encontrado")
    return {"message": "Flujo eliminado"}

# ==================== ENDPOINTS CÁLCULOS ====================

@app.get("/api/calculos")
def get_calculos(skip: int = 0, limit: int = 50, 
                 nombre: Optional[str] = None,
                 fecha_desde: Optional[str] = None,
                 fecha_hasta: Optional[str] = None):
    query = {}
    
    if nombre:
        query["nombre_producto"] = {"$regex": nombre, "$options": "i"}
    
    if fecha_desde or fecha_hasta:
        query["fecha"] = {}
        if fecha_desde:
            query["fecha"]["$gte"] = datetime.fromisoformat(fecha_desde)
        if fecha_hasta:
            query["fecha"]["$lte"] = datetime.fromisoformat(fecha_hasta)
    
    calculos = list(calculos_col.find(query).sort("fecha", -1).skip(skip).limit(limit))
    return [serialize_doc(c) for c in calculos]

@app.get("/api/calculos/{calculo_id}")
def get_calculo(calculo_id: str):
    calculo = calculos_col.find_one({"_id": ObjectId(calculo_id)})
    if not calculo:
        raise HTTPException(status_code=404, detail="Cálculo no encontrado")
    return serialize_doc(calculo)

@app.post("/api/calculos")
def guardar_calculo(calculo: Calculo):
    calculo_dict = calculo.model_dump()
    calculo_dict["fecha"] = datetime.now()
    
    # Actualizar el costo_base del producto en la base de datos
    if calculo.producto_id:
        try:
            productos_col.update_one(
                {"_id": ObjectId(calculo.producto_id)},
                {"$set": {"costo_base": calculo.costo_base}}
            )
        except:
            pass  # Si falla, continuar guardando el cálculo
    
    result = calculos_col.insert_one(calculo_dict)
    calculo_dict["_id"] = str(result.inserted_id)
    return serialize_doc(calculo_dict)

@app.delete("/api/calculos/{calculo_id}")
def eliminar_calculo(calculo_id: str):
    result = calculos_col.delete_one({"_id": ObjectId(calculo_id)})
    if result.deleted_count == 0:
        raise HTTPException(status_code=404, detail="Cálculo no encontrado")
    return {"message": "Cálculo eliminado"}

# ==================== ENDPOINTS COTIZACIONES ====================

@app.get("/api/cotizaciones")
def get_cotizaciones(skip: int = 0, limit: int = 50):
    cotizaciones = list(cotizaciones_col.find().sort("fecha", -1).skip(skip).limit(limit))
    return [serialize_doc(c) for c in cotizaciones]

@app.get("/api/cotizaciones/{cotizacion_id}")
def get_cotizacion(cotizacion_id: str):
    cotizacion = cotizaciones_col.find_one({"_id": ObjectId(cotizacion_id)})
    if not cotizacion:
        raise HTTPException(status_code=404, detail="Cotización no encontrada")
    return serialize_doc(cotizacion)

@app.post("/api/cotizaciones")
def crear_cotizacion(cotizacion: Cotizacion):
    cotizacion_dict = cotizacion.model_dump()
    cotizacion_dict["fecha"] = datetime.now()
    result = cotizaciones_col.insert_one(cotizacion_dict)
    cotizacion_dict["_id"] = str(result.inserted_id)
    return serialize_doc(cotizacion_dict)

@app.put("/api/cotizaciones/{cotizacion_id}")
def actualizar_cotizacion(cotizacion_id: str, cotizacion: Cotizacion):
    result = cotizaciones_col.update_one(
        {"_id": ObjectId(cotizacion_id)},
        {"$set": cotizacion.model_dump(exclude_unset=True)}
    )
    if result.matched_count == 0:
        raise HTTPException(status_code=404, detail="Cotización no encontrada")
    return {"message": "Cotización actualizada"}

@app.delete("/api/cotizaciones/{cotizacion_id}")
def eliminar_cotizacion(cotizacion_id: str):
    result = cotizaciones_col.delete_one({"_id": ObjectId(cotizacion_id)})
    if result.deleted_count == 0:
        raise HTTPException(status_code=404, detail="Cotización no encontrada")
    return {"message": "Cotización eliminada"}

# ==================== ENDPOINT CALCULAR ====================

@app.post("/api/calcular")
def calcular_precio(request: CalcularPrecioRequest):
    flujo = flujos_col.find_one({"_id": ObjectId(request.flujo_id)})
    if not flujo:
        raise HTTPException(status_code=404, detail="Flujo no encontrado")
    
    precio_actual = request.costo_base
    operaciones = sorted(flujo.get("operaciones", []), key=lambda x: x["orden"])
    
    for operacion in operaciones:
        nombre_op = operacion["nombre"]
        valor = request.valores_operaciones.get(nombre_op, 0)
        precio_actual = aplicar_operacion(precio_actual, operacion, valor)
    
    resultados = []
    for cliente in request.clientes:
        precio_con_ganancia = precio_actual
        ganancia = cliente.get("porcentaje_ganancia", 0)
        
        if ganancia > 0:
            precio_con_ganancia = precio_actual + (precio_actual * ganancia / 100)
        
        resultados.append({
            "nombre": cliente["nombre"],
            "porcentaje_ganancia": ganancia,
            "comentario": cliente.get("comentario", ""),
            "precio_final": round(precio_con_ganancia, 2)
        })
    
    return {
        "costo_base": request.costo_base,
        "precio_calculado": round(precio_actual, 2),  # Precio después del flujo, antes de ganancia
        "resultados": resultados
    }

# ==================== COMPARACIÓN DE PRODUCTOS ====================

import unicodedata
import re

def normalizar_texto(texto: str) -> str:
    """Normaliza texto: quita acentos, minúsculas, limpia caracteres especiales"""
    # Quitar acentos
    texto = unicodedata.normalize('NFD', texto)
    texto = ''.join(c for c in texto if unicodedata.category(c) != 'Mn')
    # Minúsculas
    texto = texto.lower().strip()
    # Quitar caracteres especiales excepto números y espacios
    texto = re.sub(r'[^a-z0-9\s/x\-\.]', ' ', texto)
    # Múltiples espacios a uno
    texto = re.sub(r'\s+', ' ', texto)
    return texto.strip()

def extraer_medidas(texto: str) -> set:
    """Extrae medidas del texto (1/4, 3/8, M8, 10mm, etc.)"""
    medidas = set()
    # Fracciones: 1/4, 3/8, 1/2, etc.
    fracciones = re.findall(r'\d+/\d+', texto)
    medidas.update(fracciones)
    # Métricas: M8, M10, etc.
    metricas = re.findall(r'm\d+', texto.lower())
    medidas.update(metricas)
    # Milímetros: 10mm, 25mm
    mm = re.findall(r'\d+\s*mm', texto.lower())
    medidas.update([m.replace(' ', '') for m in mm])
    # Pulgadas: 2", 1"
    pulgadas = re.findall(r'\d+["\']', texto)
    medidas.update(pulgadas)
    # Números solos que pueden ser medidas
    numeros = re.findall(r'\b\d+\b', texto)
    medidas.update(numeros)
    return medidas

def extraer_palabras_clave(texto: str) -> set:
    """Extrae palabras clave importantes del texto"""
    texto_norm = normalizar_texto(texto)
    palabras = set(texto_norm.split())
    # Quitar palabras muy cortas o comunes
    stopwords = {'de', 'la', 'el', 'en', 'con', 'para', 'por', 'un', 'una', 'los', 'las', 'y', 'o', 'a'}
    palabras = {p for p in palabras if len(p) > 1 and p not in stopwords}
    return palabras

def levenshtein_distance(s1: str, s2: str) -> int:
    """Calcula la distancia de Levenshtein entre dos strings"""
    if len(s1) < len(s2):
        return levenshtein_distance(s2, s1)
    if len(s2) == 0:
        return len(s1)
    
    prev_row = range(len(s2) + 1)
    for i, c1 in enumerate(s1):
        curr_row = [i + 1]
        for j, c2 in enumerate(s2):
            insertions = prev_row[j + 1] + 1
            deletions = curr_row[j] + 1
            substitutions = prev_row[j] + (c1 != c2)
            curr_row.append(min(insertions, deletions, substitutions))
        prev_row = curr_row
    return prev_row[-1]

def similitud_levenshtein(s1: str, s2: str) -> float:
    """Calcula similitud basada en Levenshtein (0-1)"""
    if not s1 or not s2:
        return 0.0
    dist = levenshtein_distance(s1, s2)
    max_len = max(len(s1), len(s2))
    return 1 - (dist / max_len)

def buscar_palabra_en_texto(palabra: str, texto: str) -> float:
    """Busca una palabra en el texto, retorna mejor score de similitud"""
    if palabra in texto:
        return 1.0
    
    palabras_texto = texto.split()
    mejor_score = 0
    
    for p in palabras_texto:
        # Similitud exacta de substring
        if palabra in p or p in palabra:
            score = min(len(palabra), len(p)) / max(len(palabra), len(p))
            mejor_score = max(mejor_score, score * 0.9)
        
        # Similitud Levenshtein
        if len(palabra) > 2 and len(p) > 2:
            lev_score = similitud_levenshtein(palabra, p)
            if lev_score > 0.7:  # Solo si es bastante similar
                mejor_score = max(mejor_score, lev_score * 0.85)
    
    return mejor_score

def calcular_similitud(busqueda: str, producto_db: str) -> float:
    """
    Calcula similitud avanzada entre texto de búsqueda y producto en DB.
    Retorna score de 0 a 1.
    """
    # Normalizar ambos textos
    busq_norm = normalizar_texto(busqueda)
    prod_norm = normalizar_texto(producto_db)
    
    if not busq_norm or not prod_norm:
        return 0.0
    
    # Match exacto
    if busq_norm == prod_norm:
        return 1.0
    
    # Score inicial
    score_total = 0.0
    peso_total = 0.0
    
    # 1. MEDIDAS (muy importante en ferretería) - Peso: 35%
    medidas_busq = extraer_medidas(busqueda)
    medidas_prod = extraer_medidas(producto_db)
    
    if medidas_busq:
        peso_medidas = 0.35
        if medidas_busq & medidas_prod:  # Hay medidas en común
            coincidencias = len(medidas_busq & medidas_prod)
            total_medidas = len(medidas_busq)
            score_medidas = coincidencias / total_medidas
            score_total += score_medidas * peso_medidas
        peso_total += peso_medidas
    
    # 2. PALABRAS CLAVE (tipo de producto) - Peso: 40%
    palabras_busq = extraer_palabras_clave(busqueda)
    palabras_prod = extraer_palabras_clave(producto_db)
    
    if palabras_busq:
        peso_palabras = 0.40
        score_palabras = 0
        
        for palabra in palabras_busq:
            # Buscar cada palabra en el producto
            mejor_match = buscar_palabra_en_texto(palabra, prod_norm)
            score_palabras += mejor_match
        
        score_palabras = score_palabras / len(palabras_busq) if palabras_busq else 0
        score_total += score_palabras * peso_palabras
        peso_total += peso_palabras
    
    # 3. SIMILITUD GENERAL (Levenshtein del texto completo) - Peso: 15%
    peso_general = 0.15
    score_general = similitud_levenshtein(busq_norm, prod_norm)
    score_total += score_general * peso_general
    peso_total += peso_general
    
    # 4. SUBSTRING MATCH - Peso: 10%
    peso_substring = 0.10
    if busq_norm in prod_norm:
        score_total += 1.0 * peso_substring
    elif prod_norm in busq_norm:
        score_total += 0.8 * peso_substring
    peso_total += peso_substring
    
    # Normalizar score final
    if peso_total > 0:
        score_final = score_total / peso_total
    else:
        score_final = 0.0
    
    # Bonus: si la primera palabra coincide exactamente (nombre del producto)
    primera_busq = busq_norm.split()[0] if busq_norm.split() else ''
    primera_prod = prod_norm.split()[0] if prod_norm.split() else ''
    if primera_busq and primera_busq == primera_prod:
        score_final = min(1.0, score_final + 0.15)
    
    return min(1.0, max(0.0, score_final))

class MatchRequest(BaseModel):
    nombres: list[str]

@app.post("/api/match-productos")
def match_productos(request: MatchRequest):
    """Busca productos similares para cada nombre dado"""
    productos = list(productos_col.find({}, {"nombre": 1, "costo_base": 1}))
    
    resultados = []
    for nombre_buscar in request.nombres:
        mejor_match = None
        mejor_score = 0
        segundo_score = 0
        
        for prod in productos:
            score = calcular_similitud(nombre_buscar, prod["nombre"])
            if score > mejor_score:
                segundo_score = mejor_score
                mejor_score = score
                mejor_match = prod
            elif score > segundo_score:
                segundo_score = score
        
        # Determinar si es sospechoso
        # - Score bajo (< 0.5)
        # - O diferencia muy pequeña con el segundo (podría ser otro producto)
        sospechoso = mejor_score < 0.5 or (mejor_score - segundo_score < 0.1 and mejor_score < 0.8)
        
        resultados.append({
            "nombre_original": nombre_buscar,
            "producto_sugerido": serialize_doc(mejor_match) if mejor_match else None,
            "score": round(mejor_score, 3),
            "sospechoso": sospechoso
        })
    
    return resultados

# ==================== HEALTH CHECK ====================

@app.get("/api/health")
def health_check():
    return {"status": "ok", "database": DB_NAME}

if __name__ == "__main__":
    import uvicorn
    uvicorn.run(app, host="0.0.0.0", port=8001)
